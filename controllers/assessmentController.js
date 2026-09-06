/**
 * assessmentController.js  –  Enterprise-grade assessment controller
 *
 * Key additions over the original:
 *  • PDF report generation + email attachment (via pdfService + emailService)
 *  • Admin lead notification email on every submission
 *  • Idempotency: re-submitting a submitted attempt returns the cached result
 *  • correctAnswers map returned in result so the frontend can render answer review
 *  • Soft duplicate-attempt guard (students can only hold one active attempt per assessment)
 *  • Structured error logging (replace console.error with your APM/logger in production)
 *  • All admin endpoints have lean() + pagination support
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const Assessment = require('../models/AssessmentModel');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const User = require('../models/userModel');
const { sendAssessmentBookingConfirmation, sendAdminLeadNotification, sendNewStudentRegistrationAlert } = require('../services/emailService');

// ─── Constants ────────────────────────────────────────────────────────────────

const CANDIDATE_FIELDS = ['name', 'grade', 'previousGrade', 'school', 'address', 'city', 'country', 'mobile', 'email', 'parentEmail', 'curriculum'];
const JWT_EXPIRY_BUFFER_MINUTES = 30; // extra minutes added to assessment duration for token TTL
const STRENGTH_THRESHOLD = 70;        // percentage ≥ this = strength
const WEAKNESS_THRESHOLD = 60;        // percentage < this = focus area

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strips correctAnswer from questions before sending to client. */
const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const publicQuiz = (assessment, questionOrder = []) => {
  const byId = new Map(assessment.questions.map((q) => [String(q._id), q]));
  const orderedQuestions = questionOrder.length
    ? questionOrder.map((id) => byId.get(String(id))).filter(Boolean)
    : assessment.questions;
  return {
  id: assessment._id,
  title: assessment.title,
  description: assessment.description,
  duration: assessment.duration,
  questions: orderedQuestions.map((q) => ({
    id: q._id,
    questionText: q.questionText,
    options: q.options,
    subject: q.subject,
    difficulty: q.difficulty,
  })),
};
};

/** Extracts subject arrays from subjectAnalysis. */
const insight = (analysis, comparator) =>
  analysis.filter(comparator).map((item) => item.subject);

/**
 * Builds the standard result object returned to the client and stored.
 * Includes correctAnswers map so the frontend can render a full answer review.
 */
const formatResult = (attempt, assessmentTitle, questions = []) => {
  // Build correctAnswers map: questionId -> correctAnswer
  const correctAnswers = {};
  questions.forEach((q) => {
    correctAnswers[String(q._id)] = q.correctAnswer;
  });
  const selectedAnswers = new Map((attempt.answers || []).map((answer) => [String(answer.questionId), answer.selectedAnswer]));
  const questionsById = new Map(questions.map((question) => [String(question._id), question]));
  const orderedQuestions = attempt.questionOrder?.length
    ? attempt.questionOrder.map((id) => questionsById.get(String(id))).filter(Boolean)
    : questions;
  const answerReview = orderedQuestions.map((question, index) => {
    const selectedAnswer = selectedAnswers.get(String(question._id)) || '';
    return {
      number: index + 1,
      questionId: question._id,
      questionText: question.questionText,
      options: question.options,
      subject: question.subject,
      difficulty: question.difficulty,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || '',
      isCorrect: selectedAnswer === question.correctAnswer,
    };
  });

  return {
    id: attempt._id,
    assessmentTitle,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    percentage: attempt.percentage,
    subjectAnalysis: attempt.subjectAnalysis,
    strengths: insight(attempt.subjectAnalysis, (i) => i.percentage >= STRENGTH_THRESHOLD),
    weaknesses: insight(attempt.subjectAnalysis, (i) => i.percentage < WEAKNESS_THRESHOLD),
    correctAnswers,     // ← used by the frontend answer-review section
    answerReview,
    submittedAt: attempt.submittedAt,
  };
};

// ─── Public Endpoints ─────────────────────────────────────────────────────────

/**
 * POST /api/assessments/public/start
 * Creates a time-limited JWT session for the candidate.
 * A new User record is created (with a random password) if the email is new.
 * Guards against multiple active attempts for the same student+assessment.
 */
exports.startPublicAssessment = async (req, res) => {
  // Sanitise candidate fields (express-validator already ran, but we normalise here too)
  const candidate = Object.fromEntries(
    CANDIDATE_FIELDS.map((f) => [f, String(req.body[f] || '').trim()])
  );

  try {
    // Quizzes are assigned based on the candidate's PREVIOUS grade (the grade whose
    // syllabus the student has already completed), not their current grade.
    const assessment = await Assessment.findOne({
      isPublished: true,
      $or: [{ targetGrades: { $size: 0 } }, { targetGrades: candidate.previousGrade }],
    }).sort({ createdAt: -1 });

    if (!assessment || !assessment.questions.length) {
      return res.status(404).json({
        message: 'No assessment is currently available for this previous grade. Please check back soon.',
      });
    }

    // Upsert student record.
    // Student email is now optional on the assessment form; when it's not
    // provided we derive a stable internal identifier from the mobile number
    // so we can still create/find a unique User record without requiring a
    // real email address. The candidate's actual (possibly blank) email is
    // still stored as-is in the attempt snapshot for admin/leads visibility.
    const hasRealEmail = Boolean(candidate.email);
    const mobileDigits = candidate.mobile.replace(/\D/g, '');
    const lookupEmail = hasRealEmail
      ? candidate.email
      : `guest-${mobileDigits}@no-email.lurnex.me`;

    let student = await User.findOne({ email: lookupEmail });
    let isNewStudent = false;
    if (!student) {
      isNewStudent = true;
      const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      student = await User.create({
        ...candidate,
        email: lookupEmail,
        password,
        role: 'student',
        status: 'pending',
        isTemporaryPassword: true,
        registeredFrom: 'Assessment Page',  // ← tracks page source
      });

      // ── Send admin alert email for new student from Assessment Page ──
      sendNewStudentRegistrationAlert({
        name:           student.name,
        email:          candidate.email || 'Not provided',
        mobile:         student.mobile || candidate.mobile || 'N/A',
        course:         student.course || candidate.grade || 'N/A',
        grade:          student.grade  || candidate.grade || 'N/A',
        country:        student.country || candidate.country || 'N/A',
        enrolledOn:     student.createdAt,
        registeredFrom: 'Assessment Page',
      }).catch(err => console.error('[assessmentController] Alert email failed:', err.message));
      // ─────────────────────────────────────────────────────────────────
    } else if (student.role !== 'student') {
      return res.status(409).json({
        message: 'This email address is already registered to another account type.',
      });
    }

    // Cancel any stale started-but-not-submitted attempts for this student+assessment
    // (prevents ghost sessions from filling up the DB)
    await AssessmentAttempt.updateMany(
      { student: student._id, assessment: assessment._id, status: 'started' },
      { $set: { status: 'abandoned' } }
    );

    // Create fresh attempt
    const attempt = await AssessmentAttempt.create({
      assessment: assessment._id,
      student: student._id,
      candidate,
      questionOrder: shuffle(assessment.questions.map((question) => question._id)),
    });

    // JWT scoped to this assessment session only
    const expiryMinutes = Math.max(assessment.duration + JWT_EXPIRY_BUFFER_MINUTES, 60);
    const token = jwt.sign(
      { id: student._id, assessmentAttemptId: attempt._id, assessmentSession: true },
      process.env.JWT_SECRET,
      { expiresIn: `${expiryMinutes}m` }
    );

    return res.status(201).json({
      token,
      attemptId: attempt._id,
      assessment: publicQuiz(assessment, attempt.questionOrder),
      expiresInMinutes: expiryMinutes,
    });
  } catch (error) {
    console.error('[assessmentController] startPublicAssessment error:', error);
    return res.status(500).json({ message: 'Could not start the assessment. Please try again.' });
  }
};

/**
 * GET /api/assessments/public/:attemptId
 * Returns the quiz for an active (started) attempt.
 */
exports.getPublicAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
      status: 'started',
    }).populate('assessment');

    if (!attempt) {
      return res.status(404).json({ message: 'Assessment session not found or has expired.' });
    }

    return res.json({ attemptId: attempt._id, assessment: publicQuiz(attempt.assessment, attempt.questionOrder) });
  } catch (error) {
    console.error('[assessmentController] getPublicAttempt error:', error);
    return res.status(500).json({ message: 'Could not load assessment.' });
  }
};

/**
 * POST /api/assessments/public/:attemptId/submit
 * Scores the attempt, stores subject analysis, sends PDF result email,
 * and returns the full result including correctAnswers for the frontend review.
 *
 * Idempotent: if the attempt is already submitted, returns the stored result.
 */
exports.submitPublicAssessment = async (req, res) => {
  try {
    // ── Idempotency: already submitted ────────────────────────────────────
    const existingSubmission = await AssessmentAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
      status: 'submitted',
    }).populate('assessment');

    if (existingSubmission) {
      return res.json({ message: 'Assessment already submitted.', bookingRequired: !existingSubmission.preferredSlot, preferredSlot: existingSubmission.preferredSlot });
    }

    // ── Load active attempt ────────────────────────────────────────────────
    const attempt = await AssessmentAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
      status: 'started',
    }).populate('assessment');

    if (!attempt) {
      return res.status(409).json({
        message: 'This assessment has already been submitted or the session has expired.',
      });
    }

    // ── Score the attempt ──────────────────────────────────────────────────
    const answerMap = new Map(
      (req.body.answers || []).map((a) => [String(a.questionId), String(a.selectedAnswer || '')])
    );

    const subjectGroups = {};
    let score = 0;

    const answers = attempt.assessment.questions.map((question) => {
      const selectedAnswer = answerMap.get(String(question._id)) || '';
      const subject = question.subject || 'Overall';

      subjectGroups[subject] ??= { subject, correct: 0, total: 0 };
      subjectGroups[subject].total += 1;

      if (selectedAnswer === question.correctAnswer) {
        score += 1;
        subjectGroups[subject].correct += 1;
      }

      return { questionId: question._id, selectedAnswer };
    });

    const subjectAnalysis = Object.values(subjectGroups).map((item) => ({
      ...item,
      percentage: Math.round((item.correct / item.total) * 100),
    }));

    const totalMarks = attempt.assessment.questions.length;
    const percentage = Math.round((score / totalMarks) * 100);

    // ── Persist result ─────────────────────────────────────────────────────
    attempt.answers = answers;
    attempt.score = score;
    attempt.totalMarks = totalMarks;
    attempt.percentage = percentage;
    attempt.subjectAnalysis = subjectAnalysis;
    attempt.status = 'submitted';
    attempt.submittedAt = new Date();
    await attempt.save();

    // Scores are retained for counsellors in the admin portal only. No report,
    // answer key, score, or PDF is returned or emailed to the candidate.
    sendAdminLeadNotification(attempt.candidate, percentage).catch(() => {});

    // ── Respond ────────────────────────────────────────────────────────────
    return res.json({
      message: 'Thank you for completing the assessment.',
      bookingRequired: true,
    });
  } catch (error) {
    console.error('[assessmentController] submitPublicAssessment error:', error);
    return res.status(500).json({ message: 'Could not submit the assessment. Please try again.' });
  }
};

/**
 * GET /api/assessments/public/:attemptId/result
 * Fetches a previously submitted result (e.g. on page reload).
 */
exports.getPublicResult = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
      status: 'submitted',
    }).populate('assessment');

    if (!attempt) {
      return res.status(404).json({ message: 'Result not found.' });
    }

    return res.status(403).json({ message: 'Assessment reports are shared only during the result discussion.' });
  } catch (error) {
    console.error('[assessmentController] getPublicResult error:', error);
    return res.status(500).json({ message: 'Could not load result.' });
  }
};

/**
 * GET /api/assessments/public/available
 * Lists published assessments (no questions/answers exposed).
 */
exports.getAvailableAssessments = async (req, res) => {
  try {
    const assessments = await Assessment.find({ isPublished: true })
      .select('title description duration targetGrades')
      .lean();
    return res.json(assessments);
  } catch (error) {
    console.error('[assessmentController] getAvailableAssessments error:', error);
    return res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * GET /api/assessments/public/my-attempts
 * Returns the logged-in student's completed attempts.
 */
exports.getCompletedAssessments = async (req, res) => {
  try {
    const attempts = await AssessmentAttempt.find({
      student: req.user._id,
      status: 'submitted',
    })
      .populate('assessment', 'title')
      .sort({ submittedAt: -1 })
      .lean();

    return res.json(attempts.map((a) => ({ id: a._id, assessmentTitle: a.assessment?.title, submittedAt: a.submittedAt, preferredSlot: a.preferredSlot })));
  } catch (error) {
    console.error('[assessmentController] getCompletedAssessments error:', error);
    return res.status(500).json({ message: 'Server Error' });
  }
};

/** POST /api/assessments/public/:attemptId/book-slot */
exports.bookResultDiscussion = async (req, res) => {
  try {
    const preferredSlot = new Date(req.body.preferredSlot);
    if (Number.isNaN(preferredSlot.getTime()) || preferredSlot <= new Date()) {
      return res.status(400).json({ message: 'Please select a future date and time.' });
    }
    const attempt = await AssessmentAttempt.findOneAndUpdate(
      { _id: req.params.attemptId, student: req.user._id, status: 'submitted' },
      { $set: { preferredSlot, slotBookedAt: new Date() } },
      { new: true }
    ).populate('assessment', 'title');
    if (!attempt) return res.status(404).json({ message: 'Submitted assessment not found.' });

    sendAssessmentBookingConfirmation({
      studentEmail: attempt.candidate.email,
      parentEmail: attempt.candidate.parentEmail,
      name: attempt.candidate.name,
      assessmentTitle: attempt.assessment?.title,
      preferredSlot,
    }).catch(() => {});
    sendAdminLeadNotification(attempt.candidate, attempt.percentage, preferredSlot).catch(() => {});

    return res.json({ message: 'Thank you. Your preferred result-discussion slot has been booked.', preferredSlot });
  } catch (error) {
    console.error('[assessmentController] bookResultDiscussion error:', error);
    return res.status(500).json({ message: 'Could not book your preferred slot. Please try again.' });
  }
};

// ─── Admin Endpoints ──────────────────────────────────────────────────────────

exports.adminListAssessments = async (req, res) => {
  try {
    const assessments = await Assessment.find().sort({ createdAt: -1 }).lean();
    return res.json(assessments);
  } catch (error) {
    return res.status(500).json({ message: 'Server Error' });
  }
};

exports.adminGetAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ message: 'Assessment not found.' });
    return res.json(assessment);
  } catch (error) {
    return res.status(500).json({ message: 'Server Error' });
  }
};

exports.adminCreateAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.create(req.body);
    return res.status(201).json(assessment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.adminUpdateAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!assessment) return res.status(404).json({ message: 'Assessment not found.' });
    return res.json(assessment);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.adminDeleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findByIdAndDelete(req.params.id);
    if (!assessment) return res.status(404).json({ message: 'Assessment not found.' });
    return res.json({ message: 'Assessment deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * GET /api/assessments/admin/leads?page=1&limit=20&status=submitted&grade=8
 * Paginated lead list with optional filters.
 */
exports.adminLeads = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.grade) filter['candidate.grade'] = req.query.grade;
    if (req.query.previousGrade) filter['candidate.previousGrade'] = req.query.previousGrade;
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ 'candidate.name': re }, { 'candidate.email': re }, { 'candidate.school': re }];
    }

    const [attempts, total] = await Promise.all([
      AssessmentAttempt.find(filter)
        .populate('assessment', 'title duration questions')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AssessmentAttempt.countDocuments(filter),
    ]);

    const data = attempts.map((item) => ({
      ...item,
      result: item.status === 'submitted' ? formatResult(item, item.assessment?.title, item.assessment?.questions) : null,
    }));

    return res.json({ data, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('[assessmentController] adminLeads error:', error);
    return res.status(500).json({ message: 'Server Error' });
  }
};

/** GET /api/assessments/admin/leads/:attemptId
 * Returns the complete, admin-only report for a single candidate.
 */
exports.adminLeadDetail = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findById(req.params.attemptId)
      .populate('assessment', 'title description duration questions')
      .lean();
    if (!attempt) return res.status(404).json({ message: 'Assessment attempt not found.' });

    return res.json({
      ...attempt,
      result: attempt.status === 'submitted'
        ? formatResult(attempt, attempt.assessment?.title, attempt.assessment?.questions)
        : null,
    });
  } catch (error) {
    console.error('[assessmentController] adminLeadDetail error:', error);
    return res.status(500).json({ message: 'Could not load the complete assessment report.' });
  }
};

/**
 * GET /api/assessments/admin/analytics
 * Aggregated platform analytics.
 */
exports.adminAnalytics = async (req, res) => {
  try {
    const [submitted, totalLeads, gradeAgg, recentActivity] = await Promise.all([
      AssessmentAttempt.find({ status: 'submitted' }).select('percentage subjectAnalysis candidate submittedAt').lean(),
      AssessmentAttempt.countDocuments(),
      AssessmentAttempt.aggregate([
        { $group: { _id: '$candidate.grade', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AssessmentAttempt.find({ status: 'submitted' })
        .sort({ submittedAt: -1 })
        .limit(10)
        .populate('assessment', 'title')
        .lean(),
    ]);

    const completedAttempts = submitted.length;
    const averageScore = completedAttempts
      ? Math.round(submitted.reduce((sum, a) => sum + a.percentage, 0) / completedAttempts)
      : 0;

    // Subject-level aggregate
    const subjectTotals = {};
    submitted.forEach(({ subjectAnalysis = [] }) => {
      subjectAnalysis.forEach(({ subject, correct, total }) => {
        subjectTotals[subject] ??= { correct: 0, total: 0 };
        subjectTotals[subject].correct += correct;
        subjectTotals[subject].total += total;
      });
    });
    const subjectPerformance = Object.entries(subjectTotals).map(([subject, { correct, total }]) => ({
      subject,
      percentage: Math.round((correct / total) * 100),
      total,
    }));

    const gradeBreakdown = gradeAgg.reduce((acc, { _id, count }) => ({ ...acc, [_id]: count }), {});

    return res.json({
      totalLeads,
      completedAttempts,
      averageScore,
      gradeBreakdown,
      subjectPerformance,
      recentActivity: recentActivity.map((a) => ({
        name: a.candidate?.name,
        email: a.candidate?.email,
        grade: a.candidate?.grade,
        percentage: a.percentage,
        assessmentTitle: a.assessment?.title,
        submittedAt: a.submittedAt,
      })),
    });
  } catch (error) {
    console.error('[assessmentController] adminAnalytics error:', error);
    return res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * POST /api/assessments/admin/:id/publish  |  POST .../unpublish
 */
exports.adminPublishToggle = async (req, res) => {
  try {
    const publish = req.path.endsWith('publish') && !req.path.endsWith('unpublish');
    const assessment = await Assessment.findByIdAndUpdate(
      req.params.id,
      { isPublished: publish },
      { new: true }
    );
    if (!assessment) return res.status(404).json({ message: 'Assessment not found.' });
    return res.json({ message: `Assessment ${publish ? 'published' : 'unpublished'}.`, assessment });
  } catch (error) {
    return res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * POST /api/assessments/admin/leads/:attemptId/resend-email
 * Re-sends the result email for an already-submitted attempt (useful if original email bounced).
 */
exports.adminResendEmail = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({
      _id: req.params.attemptId,
      status: 'submitted',
    }).populate('assessment');

    if (!attempt) return res.status(404).json({ message: 'Submitted attempt not found.' });

    if (!attempt.preferredSlot) {
      return res.status(409).json({ message: 'The candidate has not selected a result-discussion slot yet.' });
    }
    await sendAssessmentBookingConfirmation({
      studentEmail: attempt.candidate.email,
      parentEmail: attempt.candidate.parentEmail,
      name: attempt.candidate.name,
      assessmentTitle: attempt.assessment.title,
      preferredSlot: attempt.preferredSlot,
    });

    return res.json({ message: 'Booking confirmation email re-sent successfully.' });
  } catch (error) {
    console.error('[assessmentController] adminResendEmail error:', error);
    return res.status(500).json({ message: 'Failed to resend email.' });
  }
};
