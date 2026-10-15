/**
 * assessmentRoutes.js
 * Full assessment router – public + admin.
 *
 * Middleware assumed to be registered globally in app.js:
 *   - express.json()
 *   - helmet()
 *   - cors()
 *
 * Auth middleware (protect, adminOnly) should come from your existing authMiddleware.
 */

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/assessmentController');
const { protect, admin, optionalLearner } = require('../middleware/authMiddleware');
const {
  startAssessmentLimiter,
  publicAssessmentLimiter,
  adminLimiter,
} = require('../middleware/rateLimiter');
const {
  validate,
  startAssessmentRules,
  submitAssessmentRules,
  assessmentRules,
} = require('../middleware/validators');

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES  (no auth required to start; JWT issued on start)
// ─────────────────────────────────────────────────────────────────────────────

// Apply general rate limit to all public routes
router.use('/public', publicAssessmentLimiter);

// List published assessments (no auth)
router.get('/public/available', ctrl.getAvailableAssessments);

// Start a new assessment session – strict rate limit + validation
router.post(
  '/public/start',
  startAssessmentLimiter,
  startAssessmentRules,
  validate,
  optionalLearner,
  ctrl.startPublicAssessment
);

// Everything below requires a valid assessment JWT
router.use('/public', protect);

// Resume an in-progress attempt
router.get('/public/:attemptId', ctrl.getPublicAttempt);

// Submit answers
router.post(
  '/public/:attemptId/submit',
  submitAssessmentRules,
  validate,
  ctrl.submitPublicAssessment
);

// Candidate selects a result-discussion slot after submitting.
router.post('/public/:attemptId/book-slot', ctrl.bookResultDiscussion);

// Fetch a stored result (e.g. after page reload)
router.get('/public/:attemptId/result', ctrl.getPublicResult);

// Student's own completed assessments
router.get('/public/my/attempts', ctrl.getCompletedAssessments);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES  (requires auth + admin role)
// ─────────────────────────────────────────────────────────────────────────────

router.use('/admin', adminLimiter, protect, admin);

// Analytics dashboard
router.get('/admin/analytics', ctrl.adminAnalytics);

// Leads (paginated, filterable)
router.get('/admin/leads', ctrl.adminLeads);
router.get('/admin/leads/:attemptId', ctrl.adminLeadDetail);

// Resend result email for a specific submission
router.post('/admin/leads/:attemptId/resend-email', ctrl.adminResendEmail);

// Assessment CRUD
router.get('/admin', ctrl.adminListAssessments);
router.post('/admin', assessmentRules, validate, ctrl.adminCreateAssessment);
router.get('/admin/:id', ctrl.adminGetAssessment);
router.put('/admin/:id', assessmentRules, validate, ctrl.adminUpdateAssessment);
router.delete('/admin/:id', ctrl.adminDeleteAssessment);

// Publish / unpublish
router.post('/admin/:id/publish', ctrl.adminPublishToggle);
router.post('/admin/:id/unpublish', ctrl.adminPublishToggle);

module.exports = router;
