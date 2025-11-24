const express = require('express');
// ✨ IMPORT resetPassword and protect middleware
const { loginUser, registerStudent, resetPassword } = require('../controllers/authController'); 
const { protect } = require('../middleware/authMiddleware'); // Assuming this is your middleware file
const router = express.Router();

// Public route for student registration
router.post('/register-student', registerStudent); 

// Public route for login
router.post('/login', loginUser);

// ✨ NEW: Protected route for mandatory password reset
// The ID parameter is added for RESTful consistency but is often ignored 
// in favor of req.user.id for security.
router.put('/reset-password/:id', protect, resetPassword); 

module.exports = router;