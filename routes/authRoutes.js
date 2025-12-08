// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  loginUser,
  registerStudent,
  resetPassword,
} = require('../controllers/authController');

// Public
router.post('/register-student', registerStudent);
router.post('/login', loginUser);

// Protected reset password
router.put('/reset-password/:id', protect, resetPassword);

module.exports = router;
