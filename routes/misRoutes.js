const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    markClassCompleted,
    markClassCancelled,
    getMisDashboardStats,
    getTrainerTeachingHistory // <-- ADD THIS IMPORT
} = require('../controllers/misController');

// All MIS routes are protected and require admin access
router.use(protect, admin);

// @route   GET /api/mis/stats
// @desc    Get key statistics for the MIS dashboard
router.get('/stats', getMisDashboardStats);

// @route   PATCH /api/mis/class/:id/complete
// @desc    Mark a class as completed and process hours
router.patch('/class/:id/complete', markClassCompleted);

// @route   PATCH /api/mis/class/:id/cancel
// @desc    Mark a class as cancelled and send notifications
router.patch('/class/:id/cancel', markClassCancelled);

// @route   GET /api/mis/trainer-history  // <-- NEW ROUTE
// @desc    Get detailed history of all completed classes (Trainer/Student tracking)
router.get('/trainer-history', getTrainerTeachingHistory); // <-- ADD THIS LINE


module.exports = router;