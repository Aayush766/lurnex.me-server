const express = require('express');
const { getLiveClasses, getUpcomingClasses, getPastClasses } = require('../controllers/classController');
const { protect } = require('../middleware/authMiddleware'); // Middleware to protect routes
const router = express.Router();

router.get('/live', protect, getLiveClasses);
router.get('/upcoming', protect, getUpcomingClasses);
router.get('/past', protect, getPastClasses);

module.exports = router;