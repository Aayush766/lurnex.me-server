// routes/classRoutes.js
const express = require('express');
const {
  getLiveClasses,
  getUpcomingClasses,
  getPastClasses,
  getTrainerClasses,
} = require('../controllers/classController');
const { protect } = require('../middleware/authMiddleware');
// const { restrictTo } = require('../middleware/roleMiddleware'); // if you have role-based auth

const router = express.Router();

// ----- Student class views -----
router.get('/live', protect, getLiveClasses);
router.get('/upcoming', protect, getUpcomingClasses);
router.get('/past', protect, getPastClasses);

// ----- Trainer view (used by ManageClasses.jsx) -----
router.get(
  '/trainer',
  protect,
  // restrictTo('trainer'), // optional, only if you enforce roles
  getTrainerClasses
);

module.exports = router;
