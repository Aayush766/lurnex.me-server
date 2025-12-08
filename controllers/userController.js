// controllers/userController.js
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { addPasswordHistoryEntry } = require('../utils/passwordHistory');

// --- Helper function to ensure we only return necessary student data ---
const studentProjection =
  '_id name email mobile course grade school status totalPaidHours hoursHistory batchId isOneOnOne';

// @desc    Register a new student from the frontend registration flow
// @route   POST /api/auth/register-student
// @access  Public
exports.registerStudent = async (req, res) => {
  const { name, email, mobile, course, grade, school } = req.body;

  if (!name || !email || !mobile || !course || !grade || !school) {
    return res.status(400).json({ message: 'Please fill out all required fields.' });
  }

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res
        .status(409)
        .json({ message: 'A user with this email already exists.' });
    }

    const placeholderPassword = Math.random().toString(36).slice(-16);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(placeholderPassword, salt);

    const student = await User.create({
      name,
      email,
      mobile,
      course,
      grade,
      school,
      password: hashedPassword,
      role: 'student',
      status: 'pending',
      totalPaidHours: 0,
      hoursHistory: [],
      batchId: null,
      isOneOnOne: false,
      isTemporaryPassword: true,
    });

    // 🔥 Log password history (hash only)
    await addPasswordHistoryEntry(student, hashedPassword, {
      changedBy: null, // public registration
      isTemporary: true,
    });
    await student.save();

    if (student) {
      res.status(201).json({
        _id: student._id,
        name: student.name,
        email: student.email,
        message: 'Registration successful! Awaiting admin approval.',
      });
    } else {
      res.status(400).json({ message: 'Invalid student data received.' });
    }
  } catch (error) {
    console.error('Student registration error:', error);
    res
      .status(500)
      .json({ message: 'Server Error during registration.' });
  }
};

// @desc    Get a single student by ID
// @route   GET /api/admin/students/:id
// @access  Private/Admin
exports.getStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select(studentProjection);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch student' });
  }
};

// @desc    Update a student's basic details
// @route   PATCH /api/admin/students/:id
// @access  Private/Admin
exports.updateStudentDetails = async (req, res) => {
  const studentId = req.params.id;
  const {
    name,
    email,
    mobile,
    course,
    grade,
    school,
    totalPaidHours,
    batchId,
    isOneOnOne,
  } = req.body;

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // email uniqueness
    if (email && email !== student.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists && emailExists._id.toString() !== studentId.toString()) {
        return res
          .status(409)
          .json({ message: 'A user with this email already exists.' });
      }
      student.email = email;
    }

    student.name = name || student.name;
    student.mobile = mobile ?? student.mobile;
    student.course = course ?? student.course;
    student.grade = grade ?? student.grade;
    student.school = school ?? student.school;
    student.totalPaidHours =
      parseFloat(totalPaidHours) >= 0
        ? parseFloat(totalPaidHours)
        : student.totalPaidHours;

    // NEW fields
    if (batchId !== undefined) {
      student.batchId = batchId;
    }
    if (isOneOnOne !== undefined) {
      student.isOneOnOne = isOneOnOne;
    }

    const updatedStudent = await student.save();
    const fresh = await User.findById(updatedStudent._id).select(studentProjection);

    res.json(fresh);
  } catch (error) {
    console.error('Student update error:', error);
    res.status(500).json({ message: 'Server Error during student update.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(
        'name email mobile course grade school status totalPaidHours totalHoursUsed hoursHistory batchId isOneOnOne enrollmentDate profilePictureUrl'
      )
      .populate({
        path: 'batchId',
        select: 'name timing trainer',
        populate: {
          path: 'trainer',
          select: 'name',
        },
      });

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res
      .status(500)
      .json({ message: 'Server Error: Failed to fetch profile.' });
  }
};

// @desc    Update user profile (for logged-in student)
// @route   PATCH /api/users/me
// @access  Private
exports.updateMe = async (req, res) => {
  const { name, mobile, course, grade, school } = req.body;

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.name = name || user.name;
    user.mobile = mobile || user.mobile;
    user.course = course || user.course;
    user.grade = grade || user.grade;
    user.school = school || user.school;

    await user.save();

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res
      .status(500)
      .json({ message: 'Server Error: Failed to update profile.' });
  }
};

// @desc    Log a transaction and add hours to totalPaidHours
// @route   PATCH /api/admin/students/:id/add-hours
// @access  Private/Admin
exports.addExtraHours = async (req, res) => {
  const studentId = req.params.id;
  const { hours, date, notes } = req.body;

  const hoursToAdd = parseFloat(hours);
  if (!hoursToAdd || hoursToAdd <= 0 || !date) {
    return res.status(400).json({
      message:
        'A valid, positive number of hours and a purchase date are required.',
    });
  }

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    student.totalPaidHours += hoursToAdd;

    const transaction = {
      hours: hoursToAdd,
      date: new Date(date).toISOString(),
      notes: notes || 'Manual admin addition',
    };
    student.hoursHistory.push(transaction);

    const updatedStudent = await student.save();
    const fresh = await User.findById(updatedStudent._id).select(studentProjection);

    res.json(fresh);
  } catch (error) {
    console.error('Add extra hours error:', error);
    res.status(500).json({ message: 'Server Error: Failed to add hours.' });
  }
};

exports.createPurchaseRequest = async (req, res) => {
  const studentId = req.user.id;
  const { hoursToBuy, calculatedPrice } = req.body;

  if (!hoursToBuy || hoursToBuy <= 0 || !calculatedPrice) {
    return res.status(400).json({
      message: 'A valid number of hours and price are required.',
    });
  }

  try {
    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const transaction = {
      hours: parseFloat(hoursToBuy),
      date: new Date().toISOString(),
      notes: `PURCHASE REQUEST: ${hoursToBuy} hours requested. Price: $${calculatedPrice}. Awaiting admin payment/approval.`,
    };
    student.hoursHistory.push(transaction);

    await student.save();

    res.status(200).json({
      message: 'Purchase request submitted successfully.',
      transaction,
    });
  } catch (error) {
    console.error('Purchase Request Error:', error);
    res.status(500).json({
      message: 'Server Error: Failed to submit purchase request.',
    });
  }
};
