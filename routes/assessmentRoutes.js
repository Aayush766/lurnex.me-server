const express = require('express');
const { getAvailableAssessments, getCompletedAssessments } = require('../controllers/assessmentController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/available', protect, getAvailableAssessments);
router.get('/completed', protect, getCompletedAssessments);

module.exports = router;