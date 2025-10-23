// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { 
    getDashboardStats,
    getAllStudents,
    updateStudentStatus,
    createTrainer,
    updateTrainer, // ✨ NEW
    deleteTrainer, // ✨ NEW
    scheduleClassForTrainer,
    getAllClasses,
    updateClassRecording
} = require('../controllers/adminController');

// All routes in this file are protected and require admin access
router.use(protect, admin);

router.get('/stats', getDashboardStats);
router.get('/students', getAllStudents);
router.patch('/students/:id/status', updateStudentStatus);

// Trainer Routes
router.post('/trainers', createTrainer);
router.put('/trainers/:id', updateTrainer);   // ✨ NEW
router.delete('/trainers/:id', deleteTrainer); // ✨ NEW

// Class Routes
router.post('/classes', scheduleClassForTrainer);
router.get('/classes', getAllClasses);
router.patch('/classes/:id/recording', updateClassRecording); 

module.exports = router;