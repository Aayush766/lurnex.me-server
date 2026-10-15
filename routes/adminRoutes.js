// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

const {
  // Dashboard
  getDashboardStats,

  // Students
  getAllStudents,
  createStudentByAdmin,
  getStudent,
  updateStudentDetails,
  addExtraHours,
  transferStudent,
  updateStudentStatus,
  adminChangeStudentPassword,     // ✅ keep only ONCE
  getStudentPasswordHistory,
  getStudentCompletedClasses,

  // Trainers
  getAllTrainers,
  createTrainer,
  updateTrainer,
  deleteTrainer,

  // Classes & Batches
  scheduleClassForTrainer,
  getAllClasses,
  updateClassRecording,
  scheduleBulkClasses,
  createBatch,
  getAllBatches,
  getBatchDetails,
  updateBatch,
  getLiveClassesList,
} = require('../controllers/adminController');
<<<<<<< HEAD
const { listLeads, getLead, updateLead } = require('../controllers/leadController');
const learners = require('../controllers/learnerAdminController');
const { rateLimit } = require('express-rate-limit');
const learnerActionLimiter = rateLimit({ windowMs: 30 * 60 * 1000, max: 5, keyGenerator: (req) => `${req.user._id}:${req.params.id || 'link'}`, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many learner account actions. Try again later.' } });
const learnerReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, keyGenerator: (req) => String(req.user._id), standardHeaders: true, legacyHeaders: false, message: { message: 'Too many learner data requests. Try again shortly.' } });
=======
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86

// ✅ All admin routes require auth + admin
router.use(protect, admin);

// ---------------- DASHBOARD ----------------
router.get('/stats', getDashboardStats);

<<<<<<< HEAD
// ---------------- LEADS --------------------
router.get('/leads', listLeads);
router.get('/leads/:id', getLead);
router.patch('/leads/:id', updateLead);

// ---------------- LEARNER ACCOUNTS ----------
router.get('/learners', learnerReadLimiter, learners.listLearners);
router.get('/learners/:id', learnerReadLimiter, learners.getLearner);
router.patch('/learners/:id/status', learnerActionLimiter, learners.setLearnerStatus);
router.post('/learners/:id/resend-verification', learnerActionLimiter, learners.resendVerification);
router.post('/learners/link-lead', learnerActionLimiter, learners.linkLead);

=======
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
// ---------------- STUDENTS -----------------

// List + create
router.get('/students', getAllStudents);
router.post('/students', createStudentByAdmin);

// ⚠️ Put the "more specific" routes BEFORE the generic /students/:id

// Completed classes for a particular student
router.get('/students/:id/completed-classes', getStudentCompletedClasses);

// Password history for a particular student
router.get('/students/:id/password-history', getStudentPasswordHistory);

// Change a student's password (admin sets / resets it)
router.patch('/students/:id/password', adminChangeStudentPassword);   // ✅ single definition

// Add extra hours
router.patch('/students/:id/add-hours', addExtraHours);

// Transfer between batch / 1-on-1
router.patch('/students/:id/transfer', transferStudent);

// Update paid/pending
router.patch('/students/:id/status', updateStudentStatus);

// Basic CRUD on a single student
router.get('/students/:id', getStudent);
router.patch('/students/:id', updateStudentDetails);

// ---------------- TRAINERS -----------------
router.get('/trainers', getAllTrainers);
router.post('/trainers', createTrainer);
router.put('/trainers/:id', updateTrainer);
router.delete('/trainers/:id', deleteTrainer);

// ---------------- CLASSES ------------------
router.post('/classes/bulk', scheduleBulkClasses);
router.post('/classes', scheduleClassForTrainer);
router.get('/classes', getAllClasses);
router.patch('/classes/:id/recording', updateClassRecording);
router.get('/classes/live', getLiveClassesList);

// ---------------- BATCHES ------------------
router.post('/batches', createBatch);
router.get('/batches', getAllBatches);
router.get('/batches/:id', getBatchDetails);
router.patch('/batches/:id', updateBatch);

// ❌ removed duplicate:
// router.patch('/students/:id/password', adminChangeStudentPassword);

module.exports = router;
