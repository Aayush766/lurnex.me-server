const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const { protect, admin } = require('../middleware/authMiddleware');

// Route for fetching all 'trainer' users (EXISTING)
// @desc    Get all users with the role 'trainer'
// @route   GET /api/users/trainers
// @access  Private/Admin
router.get('/trainers', protect, admin, async (req, res) => {
  try {
    const trainers = await User.find({ role: 'trainer' }).select('_id name email');
    res.json(trainers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: Failed to fetch trainers' });
  }
});

// ---------------------------------------------------------------------

// ✨ NEW ROUTE: Get all 'student' users
// @desc    Get all users with the role 'student'
// @route   GET /api/users/students
// @access  Private/Admin
router.get('/students', protect, admin, async (req, res) => {
  try {
    // Select all necessary student fields, including registration data:
    const students = await User.find({ role: 'student' }).select('_id name email mobile course grade school status');
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: Failed to fetch students' });
  }
});

// ---------------------------------------------------------------------

// ✨ NEW ROUTE: Update a student's status (Approval/Payment Toggle)
// @desc    Update a student's status (paid/pending) and potentially send credentials
// @route   PATCH /api/users/students/:id/status
// @access  Private/Admin
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
    
    // Update the status
    student.status = status;
    await student.save();
    
    // 💡 Backend Action: If status is 'paid', this is where you would typically trigger 
    // an email service to generate/send the student's final login credentials.

    // Return the updated student object (matching what ManageStudents.jsx expects)
    res.json(student); 

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error: Failed to update student status' });
  }
});

module.exports = router;