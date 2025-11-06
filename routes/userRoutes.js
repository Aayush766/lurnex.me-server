const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const { protect, admin } = require('../middleware/authMiddleware'); // Import the admin middleware
const { 
    registerStudent, 
    getStudent,
    updateStudentDetails,
    addExtraHours,
    getMe,
    updateMe,
    createPurchaseRequest
} = require('../controllers/userController'); // Import the new controller functions

// Helper: Projection to return consistent student data
const studentProjection = '_id name email mobile course grade school status totalPaidHours hoursHistory';

// Route for fetching all 'trainer' users (EXISTING)
// @route   GET /api/users/trainers
router.get('/trainers', protect, admin, async (req, res) => {
    // ... (existing code)
});

// =====================================================================
// ✨ ADMIN STUDENT MANAGEMENT ROUTES (Match to frontend api calls)
// =====================================================================

// 1. CREATE New Student (from Admin Form)
// The frontend handles creation via a POST request to '/admin/students'
// @route   POST /api/users/students 
// @access  Private/Admin
router.post('/students', protect, admin, async (req, res) => {
    const { name, email, mobile, course, grade, school, totalPaidHours } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        // Since this is admin-created, use a temporary password and hash it
        const tempPassword = Math.random().toString(36).slice(-10);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);
        
        const student = await User.create({
            name, email, mobile, course, grade, school, 
            totalPaidHours: parseFloat(totalPaidHours) || 0,
            password: hashedPassword,
            role: 'student',
            status: 'pending', // Default status for new students
        });
        
        // Return the newly created student object
        res.status(201).json(await User.findById(student._id).select(studentProjection)); 

    } catch (error) {
        console.error("Admin create student error:", error);
        res.status(500).json({ message: 'Server Error during student creation.' });
    }
});


// 2. GET All 'student' users
// @route   GET /api/users/students
// @access  Private/Admin
router.get('/students', protect, admin, async (req, res) => {
    try {
      // Include the new fields in the selection: totalPaidHours and hoursHistory
      const students = await User.find({ role: 'student' }).select(studentProjection);
      res.json(students);
    } catch (error) {
      res.status(500).json({ message: 'Server Error: Failed to fetch students' });
    }
});

// 3. UPDATE Student Details
// @route   PATCH /api/users/students/:id
// @access  Private/Admin
router.patch('/students/:id', protect, admin, updateStudentDetails); // Uses the new controller function
router.post('/purchase-request', protect, createPurchaseRequest); // Line ~25
// 4. ADD Extra Hours Transaction
// @route   PATCH /api/users/students/:id/add-hours
// @access  Private/Admin
router.patch('/students/:id/add-hours', protect, admin, addExtraHours); // Uses the new controller function
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
// 5. TOGGLE Student Status (Approval/Payment)
// @route   PATCH /api/users/students/:id/status
// @access  Private/Admin
router.patch('/students/:id/status', protect, admin, async (req, res) => {
    const { status } = req.body;
    const studentId = req.params.id;

    if (!status || !['paid', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
      const student = await User.findById(studentId);

      if (!student || student.role !== 'student') {
        return res.status(404).json({ message: 'Student not found.' });
      }
    
      student.status = status;
      await student.save();
    
      // Return the updated student object including the new fields
      res.json(await User.findById(studentId).select(studentProjection)); 

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server Error: Failed to update student status' });
    }
});

module.exports = router;