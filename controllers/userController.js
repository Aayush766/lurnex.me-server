// controllers/userController.js (NEW or MERGED)

const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

// @desc    Register a new student from the frontend registration flow
// @route   POST /api/auth/register-student
// @access  Public
exports.registerStudent = async (req, res) => {
    // Data collected from the frontend
    const { studentName, email, mobile, course, grade, school } = req.body;

    if (!studentName || !email || !mobile || !course || !grade || !school) {
        return res.status(400).json({ message: 'Please fill out all required fields.' });
    }

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        // Generate a random, secure placeholder password.
        // The real login password will be generated/sent when the admin changes status to 'paid'.
        const placeholderPassword = Math.random().toString(36).slice(-16);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(placeholderPassword, salt);

        const student = await User.create({
            name: studentName,
            email,
            mobile,
            course, // Requires update to userModel.js
            grade,  // Requires update to userModel.js
            school, // Requires update to userModel.js
            password: hashedPassword,
            role: 'student',
            status: 'pending' // Initial status for admin review/payment
        });

        if (student) {
            // Success: Student created and is now visible in the Admin Panel's 'Manage Students' list.
            res.status(201).json({
                _id: student._id,
                name: student.name,
                email: student.email,
                message: 'Registration successful! Awaiting admin approval.'
            });
        } else {
            res.status(400).json({ message: 'Invalid student data received.' });
        }

    } catch (error) {
        console.error("Student registration error:", error);
        res.status(500).json({ message: 'Server Error during registration.' });
    }
};