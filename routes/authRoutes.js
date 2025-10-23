const express = require('express');
const { loginUser, registerStudent } = require('../controllers/authController'); // <-- 🎯 CORRECTED IMPORT
const router = express.Router();
// const userController = require('../controllers/userController'); // <-- ❌ UNNECESSARY for these routes

// Public route for student registration
// Now correctly uses the registerStudent function from authController
router.post('/register-student', registerStudent); 

// Public route for login
router.post('/login', loginUser);

module.exports = router;