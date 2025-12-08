// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const User = require('../models/userModel');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  registerStudent,
  getStudent,            // imported but not directly used here (you can remove if unused)
  updateStudentDetails,
  addExtraHours,
  getMe,
  updateMe,
  createPurchaseRequest,
} = require('../controllers/userController');
const { addPasswordHistoryEntry } = require('../utils/passwordHistory');

// Helper: Projection to return consistent student data
const studentProjection =
  '_id name email mobile course grade school status totalPaidHours hoursHistory batchId isOneOnOne';

// TRAINER PROJECTION
const trainerProjection =
  '_id name email mobile subject role status profilePictureUrl documents totalHoursTaught teachingHistory';

// =====================================================================
// TRAINER ROUTES (used by ManageTrainers.jsx with /admin/trainers)
// =====================================================================

// GET all trainers
// @route   GET /api/admin/trainers
// @access  Private/Admin
router.get('/trainers', protect, admin, async (req, res) => {
  try {
    const trainers = await User.find({ role: 'trainer' }).select(trainerProjection);
    res.json(trainers);
  } catch (error) {
    console.error('Server Error: Failed to fetch trainers', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch trainers' });
  }
});

// CREATE new trainer
// @route   POST /api/admin/trainers
// @access  Private/Admin
router.post('/trainers', protect, admin, async (req, res) => {
  const { name, email, password, mobile, subject, profilePictureUrl, documents } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const trainer = await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      subject,
      profilePictureUrl: profilePictureUrl || '',
      documents: documents || [],
      role: 'trainer',
      status: 'pending',
      isTemporaryPassword: true,
    });

    // 🔥 Log trainer password history
    await addPasswordHistoryEntry(trainer, hashedPassword, {
      changedBy: req.user ? req.user._id : null,
      isTemporary: true,
    });
    await trainer.save();

    const freshTrainer = await User.findById(trainer._id).select(trainerProjection);

    // TODO: send email with credentials if needed

    res.status(201).json(freshTrainer);
  } catch (error) {
    console.error('Admin create trainer error:', error);
    res.status(500).json({ message: 'Server Error during trainer creation.' });
  }
});

// UPDATE trainer
// @route   PUT /api/admin/trainers/:id
// @access  Private/Admin
router.put('/trainers/:id', protect, admin, async (req, res) => {
  const trainerId = req.params.id;
  const { name, email, password, mobile, subject, profilePictureUrl, documents } = req.body;

  try {
    const trainer = await User.findById(trainerId);

    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({ message: 'Trainer not found.' });
    }

    // Check email uniqueness if email is changed
    if (email && email !== trainer.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists && emailExists._id.toString() !== trainerId.toString()) {
        return res.status(409).json({ message: 'A user with this email already exists.' });
      }
      trainer.email = email;
    }

    if (name) trainer.name = name;
    if (mobile !== undefined) trainer.mobile = mobile;
    if (subject !== undefined) trainer.subject = subject;
    if (profilePictureUrl !== undefined) trainer.profilePictureUrl = profilePictureUrl;
    if (documents !== undefined) trainer.documents = documents;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      trainer.password = hashed;
      trainer.isTemporaryPassword = true;

      // 🔥 Log password history
      await addPasswordHistoryEntry(trainer, hashed, {
        changedBy: req.user ? req.user._id : null,
        isTemporary: true,
      });
    }

    const updatedTrainer = await trainer.save();
    const freshTrainer = await User.findById(updatedTrainer._id).select(trainerProjection);

    res.json(freshTrainer);
  } catch (error) {
    console.error('Admin update trainer error:', error);
    res.status(500).json({ message: 'Server Error: Failed to update trainer.' });
  }
});

// DELETE trainer
// @route   DELETE /api/admin/trainers/:id
// @access  Private/Admin
router.delete('/trainers/:id', protect, admin, async (req, res) => {
  const trainerId = req.params.id;

  try {
    const trainer = await User.findById(trainerId);

    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({ message: 'Trainer not found.' });
    }

    // TODO: also clean up classes assigned to this trainer if needed
    await trainer.deleteOne();

    res.json({ message: 'Trainer deleted successfully.' });
  } catch (error) {
    console.error('Admin delete trainer error:', error);
    res.status(500).json({ message: 'Server Error: Failed to delete trainer.' });
  }
});

// =====================================================================
// ADMIN STUDENT MANAGEMENT ROUTES
// =====================================================================

// 1. CREATE New Student (from Admin Form)
// @route   POST /api/admin/students
// @access  Private/Admin
router.post('/students', protect, admin, async (req, res) => {
  const { name, email, mobile, course, grade, school, totalPaidHours } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const tempPassword = Math.random().toString(36).slice(-10);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    const student = await User.create({
      name,
      email,
      mobile,
      course,
      grade,
      school,
      totalPaidHours: parseFloat(totalPaidHours) || 0,
      password: hashedPassword,
      role: 'student',
      status: 'pending',
      isTemporaryPassword: true,
    });

    // 🔥 Log password history
    await addPasswordHistoryEntry(student, hashedPassword, {
      changedBy: req.user ? req.user._id : null,
      isTemporary: true,
    });
    await student.save();

    const freshStudent = await User.findById(student._id).select(studentProjection);

    res.status(201).json(freshStudent);
  } catch (error) {
    console.error('Admin create student error:', error);
    res.status(500).json({ message: 'Server Error during student creation.' });
  }
});

// 2. GET All 'student' users
// @route   GET /api/admin/students
// @access  Private/Admin
router.get('/students', protect, admin, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select(studentProjection);
    res.json(students);
  } catch (error) {
    console.error('Server Error: Failed to fetch students', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch students' });
  }
});

// 3. UPDATE Student Details
// @route   PATCH /api/admin/students/:id
// @access  Private/Admin
router.patch('/students/:id', protect, admin, updateStudentDetails);

// 4. ADD Extra Hours Transaction
// @route   PATCH /api/admin/students/:id/add-hours
// @access  Private/Admin
router.patch('/students/:id/add-hours', protect, admin, addExtraHours);

// 5. TOGGLE Student Status (Approval/Payment)
// @route   PATCH /api/admin/students/:id/status
// @access  Private/Admin
router.patch('/students/:id/status', protect, admin, async (req, res) => {
  const { status } = req.body;
  const studentId = req.params.id;

  if (!status || !['paid', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided.' });
  }

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    student.status = status;
    await student.save();

    const freshStudent = await User.findById(studentId).select(studentProjection);
    res.json(freshStudent);
  } catch (error) {
    console.error('Server Error: Failed to update student status', error);
    res.status(500).json({ message: 'Server Error: Failed to update student status' });
  }
});

// 6. 🔥 ADMIN CHANGE STUDENT PASSWORD
// @route   PATCH /api/admin/students/:id/password
// @access  Private/Admin
router.patch('/students/:id/password', protect, admin, async (req, res) => {
  const studentId = req.params.id;
  const { newPassword, isTemporary } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: 'New password is required.' });
  }

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    student.password = hashed;
    student.isTemporaryPassword = !!isTemporary;

    await addPasswordHistoryEntry(student, hashed, {
      changedBy: req.user ? req.user._id : null,
      isTemporary: !!isTemporary,
    });

    await student.save();

    // Admin sees newPassword ONCE here (don’t log or store plaintext).
    res.json({
      message: 'Student password updated successfully.',
      studentId: student._id,
      newPassword,
    });
  } catch (error) {
    console.error('Admin change student password error:', error);
    res.status(500).json({ message: 'Server Error: Failed to change password.' });
  }
});

// 7. 🔥 ADMIN VIEW STUDENT PASSWORD HISTORY
// @route   GET /api/admin/students/:id/password-history
// @access  Private/Admin
router.get('/students/:id/password-history', protect, admin, async (req, res) => {
  const studentId = req.params.id;

  try {
    const student = await User.findById(studentId)
      .select('passwordHistory name email')
      .populate('passwordHistory.changedBy', 'name email role');

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const history = (student.passwordHistory || []).map((entry) => ({
      changedAt: entry.changedAt,
      isTemporary: entry.isTemporary,
      changedBy: entry.changedBy
        ? {
            _id: entry.changedBy._id,
            name: entry.changedBy.name,
            email: entry.changedBy.email,
            role: entry.changedBy.role,
          }
        : null,
      // Hash preview (for debugging/audit only, not real password)
      passwordHashPreview: entry.passwordHash
        ? `${entry.passwordHash.slice(0, 6)}...${entry.passwordHash.slice(-6)}`
        : null,
    }));

    res.json({
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
      },
      history,
    });
  } catch (error) {
    console.error('Get student password history error:', error);
    res.status(500).json({
      message: 'Server Error: Failed to fetch password history.',
    });
  }
});

// =====================================================================
// STUDENT SELF ROUTES
// =====================================================================

// If you actually mount registerStudent here (check your server.js),
// this is a public route:
router.post('/register-student', registerStudent);

router.post('/purchase-request', protect, createPurchaseRequest);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);

module.exports = router;
