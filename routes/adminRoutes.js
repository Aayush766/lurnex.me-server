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

// ✅ All admin routes require auth + admin
router.use(protect, admin);

// ---------------- DASHBOARD ----------------
router.get('/stats', getDashboardStats);

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
