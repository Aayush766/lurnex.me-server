// controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const { addPasswordHistoryEntry } = require('../utils/passwordHistory');

// Helper: generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc   Register new student (public)
// @route  POST /api/auth/register-student
exports.registerStudent = async (req, res) => {
  const { name, email, mobile, course, grade, school } = req.body;

  if (!name || !email || !mobile || !course || !grade || !school) {
    return res.status(400).json({ message: 'Please include all required fields.' });
  }

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    const user = await User.create({
      name,
      email,
      mobile,
      course,
      grade,
      school,
      password: hashedPassword,
      role: 'student',
      status: 'pending',
      isTemporaryPassword: true,
      totalPaidHours: 0,
      hoursHistory: [],
      batchId: null,
      isOneOnOne: false,
    });

    await addPasswordHistoryEntry(user, hashedPassword, {
      changedBy: null,
      isTemporary: true,
    });
    await user.save();

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      message: 'Registration successful! Awaiting admin approval.',
    });
  } catch (error) {
    console.error('Student Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc   Login user
// @route  POST /api/auth/login
exports.loginUser = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const user = await User.findOne({ email, role });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials (User not found)' });
    }

    // Block pending students
    if (user.role === 'student' && user.status === 'pending') {
      return res.status(403).json({
        message: 'Account pending approval. Please contact support.',
      });
    }

    if (await bcrypt.compare(password, user.password)) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isTemporaryPassword: user.isTemporaryPassword,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials (Password mismatch)' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc   Logged-in user reset password (mandatory reset flow)
// @route  PUT /api/auth/reset-password/:id
// @access Private (protect)
exports.resetPassword = async (req, res) => {
  // Use ID from token, not URL
  const userId = req.user.id;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: 'New password is required.' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    user.password = hashed;
    user.isTemporaryPassword = false;

    await addPasswordHistoryEntry(user, hashed, {
      changedBy: user._id,
      isTemporary: false,
    });

    await user.save();

    res.status(200).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isTemporaryPassword: false,
      token: generateToken(user._id),
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('Password Reset Server Error:', error);
    res.status(500).json({ message: 'Server Error during password reset.' });
  }
};

module.exports.generateToken = generateToken;
