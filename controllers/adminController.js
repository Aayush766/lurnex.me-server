// controllers/adminController.js
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const Class = require('../models/classModel');
const Batch = require('../models/batchModel');
const { createZoomMeeting } = require('../services/zoomService');
const { sendLoginCredentials } = require('../services/emailService');
const { addPasswordHistoryEntry } = require('../utils/passwordHistory');

// Projection reused for student return
const studentProjection =
  '_id name email mobile course grade school status totalPaidHours hoursHistory batchId isOneOnOne';

// ================== DASHBOARD STATS ==================

// @desc   Get dashboard stats
// @route  GET /api/admin/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const activeTrainers = await User.countDocuments({ role: 'trainer' });

    const now = new Date();
    const liveClasses = await Class.countDocuments({
      startTime: { $lte: now },
      endTime: { $gte: now },
    });

    res.json({ totalStudents, activeTrainers, liveClasses });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ================== STUDENT CRUD (ADMIN) ==================

// @desc   Get all students
// @route  GET /api/admin/students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select(studentProjection)
      .populate('batchId', 'name');
    res.json(students);
  } catch (error) {
    console.error('Get all students error:', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch students' });
  }
};

// @desc   Create a new student via Admin Form
// @route  POST /api/admin/students
exports.createStudentByAdmin = async (req, res) => {
  const { name, email, mobile, course, grade, school, totalPaidHours } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const tempPassword = Math.random().toString(36).slice(-10);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    const student = await User.create({
      name,
      email,
      mobile,
      course,
      grade,
      school,
      totalPaidHours: parseFloat(totalPaidHours) || 0,
      password: hashedPassword,
      role: 'student',
      status: 'pending',
      isTemporaryPassword: true,
    });

    await addPasswordHistoryEntry(student, hashedPassword, {
      changedBy: req.user ? req.user._id : null,
      isTemporary: true,
    });
    await student.save();

    const fresh = await User.findById(student._id)
      .select(studentProjection)
      .populate('batchId', 'name');

    // Optionally send credentials by email
    await sendLoginCredentials(email, tempPassword);

    res.status(201).json(fresh);
  } catch (error) {
    console.error('Admin create student error:', error);
    res.status(500).json({ message: 'Server Error during student creation.' });
  }
};

// @desc   Get a single student by ID
// @route  GET /api/admin/students/:id
exports.getStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id)
      .select(studentProjection)
      .populate('batchId', 'name');

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch student' });
  }
};

// @desc   Update a student's basic details
// @route  PATCH /api/admin/students/:id
exports.updateStudentDetails = async (req, res) => {
  const studentId = req.params.id;
  const { name, email, mobile, course, grade, school, totalPaidHours } = req.body;

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    if (email && email !== student.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists && String(emailExists._id) !== studentId) {
        return res.status(409).json({ message: 'Email already in use by another user.' });
      }
      student.email = email;
    }

    student.name = name || student.name;
    student.mobile = mobile ?? student.mobile;
    student.course = course ?? student.course;
    student.grade = grade ?? student.grade;
    student.school = school ?? student.school;
    student.totalPaidHours =
      parseFloat(totalPaidHours) >= 0 ? parseFloat(totalPaidHours) : student.totalPaidHours;

    const updatedStudent = await student.save();
    const fresh = await User.findById(updatedStudent._id)
      .select(studentProjection)
      .populate('batchId', 'name');

    res.json(fresh);
  } catch (error) {
    console.error('Student update error:', error);
    res.status(500).json({ message: 'Server Error during student update.' });
  }
};

// @desc   Add hours & log transaction
// @route  PATCH /api/admin/students/:id/add-hours
exports.addExtraHours = async (req, res) => {
  const studentId = req.params.id;
  const { hours, date, notes } = req.body;

  const hoursToAdd = parseFloat(hours);
  if (isNaN(hoursToAdd) || hoursToAdd <= 0 || !date) {
    return res
      .status(400)
      .json({ message: 'A valid, positive number of hours and a purchase date are required.' });
  }

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    student.totalPaidHours += hoursToAdd;
    if (!student.hoursHistory) student.hoursHistory = [];

    const transaction = {
      hours: hoursToAdd,
      date: new Date(date).toISOString(),
      notes: notes || 'Manual admin addition',
    };
    student.hoursHistory.push(transaction);

    const updatedStudent = await student.save();
    const fresh = await User.findById(updatedStudent._id)
      .select(studentProjection)
      .populate('batchId', 'name');

    res.json(fresh);
  } catch (error) {
    console.error('Add extra hours error:', error);
    res.status(500).json({ message: 'Server Error: Failed to add hours.' });
  }
};

// @desc   Transfer student (batch / one-on-one)
// @route  PATCH /api/admin/students/:id/transfer
exports.transferStudent = async (req, res) => {
  const studentId = req.params.id;
  const { isOneOnOne, batchId } = req.body;

  if (isOneOnOne === undefined) {
    return res.status(400).json({ message: 'isOneOnOne status is required.' });
  }

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    let updateFields = { isOneOnOne };

    if (isOneOnOne) {
      updateFields.batchId = null;
    } else {
      if (!batchId) {
        return res.status(400).json({ message: 'Batch ID is required for batch assignment.' });
      }

      const batchExists = await Batch.findById(batchId);
      if (!batchExists) {
        return res.status(400).json({ message: 'Invalid Batch ID provided.' });
      }

      updateFields.batchId = batchId;
    }

    const updatedStudent = await User.findByIdAndUpdate(studentId, updateFields, {
      new: true,
      runValidators: true,
    })
      .select(studentProjection)
      .populate('batchId', 'name');

    if (!updatedStudent) {
      return res.status(500).json({ message: 'Failed to update student assignment.' });
    }

    res.json({ message: 'Student assignment updated successfully.', student: updatedStudent });
  } catch (error) {
    console.error('Transfer Student Error:', error);
    res.status(500).json({ message: 'Server Error during student transfer.' });
  }
};

// @desc   Update student status (pending <-> paid)
// @route  PATCH /api/admin/students/:id/status
exports.updateStudentStatus = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    const oldStatus = student.status;
    student.status = req.body.status || student.status;

    // If moving from pending to paid, generate temp password & email
    if (oldStatus === 'pending' && student.status === 'paid') {
      const temporaryPassword = Math.random().toString(36).slice(-8);
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(temporaryPassword, salt);

      student.password = hashed;
      student.isTemporaryPassword = true;

      await addPasswordHistoryEntry(student, hashed, {
        changedBy: req.user ? req.user._id : null,
        isTemporary: true,
      });

      await sendLoginCredentials(student.email, temporaryPassword);
    }

    const updatedStudent = await student.save();
    const fresh = await User.findById(updatedStudent._id)
      .select(studentProjection)
      .populate('batchId', 'name');

    res.json(fresh);
  } catch (error) {
    console.error('Error updating student status:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// ================== ADMIN PASSWORD CONTROL ==================

// @desc   Admin changes a student's password
// @route  PATCH /api/admin/students/:id/password
exports.adminChangeStudentPassword = async (req, res) => {
  const studentId = req.params.id;
  const { newPassword, isTemporary } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: 'New password is required.' });
  }

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    student.password = hashed;
    student.isTemporaryPassword = !!isTemporary;

    await addPasswordHistoryEntry(student, hashed, {
      changedBy: req.user ? req.user._id : null,
      isTemporary: !!isTemporary,
    });

    await student.save();

    // IMPORTANT: newPassword only sent in response ONCE; not stored as plaintext.
    res.json({
      message: 'Student password updated successfully.',
      studentId: student._id,
      newPassword,
    });
  } catch (error) {
    console.error('Admin change student password error:', error);
    res.status(500).json({ message: 'Server Error: Failed to change password.' });
  }
};

// @desc   Get student's password history (hash preview + metadata)
// @route  GET /api/admin/students/:id/password-history
exports.getStudentPasswordHistory = async (req, res) => {
  const studentId = req.params.id;

  try {
    const student = await User.findById(studentId)
      .select('passwordHistory name email role')   // ⬅️ add role here
      .populate('passwordHistory.changedBy', 'name email role');

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const history = (student.passwordHistory || []).map((entry) => ({
      changedAt: entry.changedAt,
      isTemporary: entry.isTemporary,
      changedBy: entry.changedBy
        ? {
            _id: entry.changedBy._id,
            name: entry.changedBy.name,
            email: entry.changedBy.email,
            role: entry.changedBy.role,
          }
        : null,
      passwordHashPreview: entry.passwordHash
        ? `${entry.passwordHash.slice(0, 6)}...${entry.passwordHash.slice(-6)}`
        : null,
    }));

    res.json({
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
      },
      history,
    });
  } catch (error) {
    console.error('Get student password history error:', error);
    res
      .status(500)
      .json({ message: 'Server Error: Failed to fetch password history.' });
  }
};

// ================== TRAINER CRUD ==================

const trainerProjection =
  '_id name email mobile subject role status profilePictureUrl documents totalHoursTaught teachingHistory';

// @desc   Get all trainers
// @route  GET /api/admin/trainers
exports.getAllTrainers = async (req, res) => {
  try {
    const trainers = await User.find({ role: 'trainer' }).select(trainerProjection);
    res.json(trainers);
  } catch (error) {
    console.error('Error fetching trainers:', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch trainers.' });
  }
};

// @desc   Create trainer
// @route  POST /api/admin/trainers
exports.createTrainer = async (req, res) => {
  const { name, email, password, mobile, subject, profilePictureUrl, documents } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const trainer = await User.create({
      name,
      email,
      password: hashedPassword,
      mobile,
      subject,
      profilePictureUrl: profilePictureUrl || '',
      documents: documents || [],
      role: 'trainer',
      status: 'pending',
      isTemporaryPassword: true,
    });

    await addPasswordHistoryEntry(trainer, hashedPassword, {
      changedBy: req.user ? req.user._id : null,
      isTemporary: true,
    });
    await trainer.save();

    const freshTrainer = await User.findById(trainer._id).select(trainerProjection);

    await sendLoginCredentials(email, password);

    res.status(201).json(freshTrainer);
  } catch (error) {
    console.error('Admin create trainer error:', error);
    res.status(500).json({ message: 'Server Error during trainer creation.' });
  }
};

// @desc   Update trainer
// @route  PUT /api/admin/trainers/:id
exports.updateTrainer = async (req, res) => {
  const trainerId = req.params.id;
  const { name, email, password, mobile, subject, profilePictureUrl, documents } = req.body;

  try {
    const trainer = await User.findById(trainerId);

    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({ message: 'Trainer not found.' });
    }

    if (email && email !== trainer.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists && emailExists._id.toString() !== trainerId.toString()) {
        return res.status(409).json({ message: 'A user with this email already exists.' });
      }
      trainer.email = email;
    }

    if (name) trainer.name = name;
    if (mobile !== undefined) trainer.mobile = mobile;
    if (subject !== undefined) trainer.subject = subject;
    if (profilePictureUrl !== undefined) trainer.profilePictureUrl = profilePictureUrl;
    if (documents !== undefined) trainer.documents = documents;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      trainer.password = hashed;
      trainer.isTemporaryPassword = true;

      await addPasswordHistoryEntry(trainer, hashed, {
        changedBy: req.user ? req.user._id : null,
        isTemporary: true,
      });
    }

    const updatedTrainer = await trainer.save();
    const freshTrainer = await User.findById(updatedTrainer._id).select(trainerProjection);

    res.json(freshTrainer);
  } catch (error) {
    console.error('Admin update trainer error:', error);
    res.status(500).json({ message: 'Server Error: Failed to update trainer.' });
  }
};

// @desc   Delete trainer
// @route  DELETE /api/admin/trainers/:id
exports.deleteTrainer = async (req, res) => {
  const trainerId = req.params.id;

  try {
    const trainer = await User.findById(trainerId);

    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({ message: 'Trainer not found.' });
    }

    await Class.deleteMany({ trainer: trainerId });
    await trainer.deleteOne();

    res.json({ message: 'Trainer and associated data removed successfully' });
  } catch (error) {
    console.error('Admin delete trainer error:', error);
    res.status(500).json({ message: 'Server Error: Failed to delete trainer.' });
  }
};

// ================== RECURRENCE UTIL FOR BULK CLASSES ==================

const generateRecurrenceDates = (start, end, recurringData = {}) => {
  if (!recurringData.isRecurring || !start || !end || isNaN(start.getTime())) {
    return [{ startTime: start, endTime: end }];
  }

  const { frequency, interval, daysOfWeek, endType, endDate, endCount } = recurringData;
  const durationMs = end.getTime() - start.getTime();
  const startHour = start.getHours();
  const startMinute = start.getMinutes();

  const recurrenceList = [];
  let currentDate = new Date(start.getTime());
  let count = 0;

  const MAX_SCHEDULED = endType === 'count' ? endCount : 500;
  const END_DATE_LIMIT = endType === 'date' && endDate ? new Date(endDate) : null;

  const isPastEnd = (date) => {
    if (END_DATE_LIMIT && date.getTime() > END_DATE_LIMIT.getTime()) return true;
    return false;
  };

  const setClassTime = (date) => {
    const classStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      startHour,
      startMinute
    );
    const classEnd = new Date(classStart.getTime() + durationMs);
    return { classStart, classEnd };
  };

  let lastGeneratedDate = new Date(currentDate.getTime());

  while (count < MAX_SCHEDULED && count < 500) {
    let nextDate = new Date(lastGeneratedDate.getTime());

    if (count > 0) {
      if (frequency === 'daily') {
        nextDate.setDate(nextDate.getDate() + interval);
      } else if (frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7 * interval);
      } else if (frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + interval);
      } else {
        break;
      }
    }

    const nextTimes = setClassTime(nextDate);

    if (isPastEnd(nextTimes.classStart)) break;

    const dayOfWeek = nextTimes.classStart.getDay().toString();
    if (count > 0 && frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
      // TODO: refine logic for multiple days; keeping simple
      if (!daysOfWeek.includes(dayOfWeek)) {
        lastGeneratedDate = nextDate;
        count++;
        continue;
      }
    }

    recurrenceList.push({ startTime: nextTimes.classStart, endTime: nextTimes.classEnd });
    lastGeneratedDate = nextDate;
    count++;

    if (count === MAX_SCHEDULED) break;
  }

  return recurrenceList;
};

// ================== CLASS & BATCH MANAGEMENT ==================

// @desc   Bulk schedule classes (recurring)
// @route  POST /api/admin/classes/bulk
exports.scheduleBulkClasses = async (req, res) => {
  const { baseClass, recurring } = req.body;
  const { title, trainerId, startTime, endTime, batchId, studentIds } = baseClass;

  if (!title || !trainerId || !startTime || !endTime) {
    return res.status(400).json({ message: 'Title, trainer, start time, and end time are required.' });
  }

  if (!batchId && (!studentIds || studentIds.length === 0)) {
    return res
      .status(400)
      .json({ message: 'Class must be assigned to a Batch or at least one Student.' });
  }

  try {
    const trainer = await User.findById(trainerId);
    if (!trainer || trainer.role !== 'trainer') {
      return res.status(404).json({ message: 'Assigned trainer not found or is not a trainer.' });
    }

    let studentsToEnroll = [];
    let batch;

    if (batchId) {
      batch = await Batch.findById(batchId);
      if (!batch) {
        return res.status(404).json({ message: 'Assigned batch not found.' });
      }
      studentsToEnroll = await User.find({ batchId, role: 'student' }).select('_id');
    } else if (studentIds && studentIds.length > 0) {
      const foundStudents = await User.find({
        _id: { $in: studentIds },
        role: 'student',
      }).select('_id');

      if (foundStudents.length !== studentIds.length) {
        return res.status(404).json({ message: 'One or more assigned students were not found.' });
      }
      studentsToEnroll = foundStudents;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const recurrenceDates = generateRecurrenceDates(start, end, recurring);

    if (recurrenceDates.length === 0) {
      return res
        .status(400)
        .json({ message: 'No valid class dates generated based on recurrence rules.' });
    }

    const createdClasses = [];
    const newClassIds = [];

    for (const { startTime: classStart, endTime: classEnd } of recurrenceDates) {
      const durationMinutes = Math.round(
        (classEnd.getTime() - classStart.getTime()) / (1000 * 60)
      );
      if (durationMinutes <= 0) continue;

      const zoomLink = await createZoomMeeting(
        `${title} - ${classStart.toLocaleDateString()}`,
        classStart.toISOString(),
        durationMinutes
      );

      const newClass = new Class({
        title,
        trainer: trainerId,
        startTime: classStart,
        endTime: classEnd,
        zoomLink,
        batchId: batch ? batch._id : undefined,
        studentIds: studentIds && studentIds.length > 0 ? studentIds : [],
      });

      const savedClass = await newClass.save();
      createdClasses.push(savedClass);
      newClassIds.push(savedClass._id);
    }

    if (batch) {
      batch.classes.push(...newClassIds);
      await batch.save();
    }

    if (studentsToEnroll.length > 0) {
      const studentIdsToUpdate = studentsToEnroll.map((s) => s._id);

      await User.updateMany(
        { _id: { $in: studentIdsToUpdate } },
        { $push: { enrolledClasses: { $each: newClassIds } } }
      );
    }

    const populatedClasses = await Class.find({ _id: { $in: newClassIds } }).populate(
      'trainer',
      'name'
    );

    res.status(201).json(populatedClasses);
  } catch (error) {
    console.error('Bulk class scheduling error:', error);
    res.status(500).json({ message: 'Server Error: Failed to schedule class(es).' });
  }
};

// @desc   Schedule a class for a trainer
// @route  POST /api/admin/classes
exports.scheduleClassForTrainer = async (req, res) => {
  const { title, startTime, endTime, trainerId } = req.body;

  if (!title || !startTime || !endTime || !trainerId) {
    return res
      .status(400)
      .json({ message: 'Please provide title, startTime, endTime, and trainerId' });
  }

  try {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const duration = (endDate.getTime() - startDate.getTime()) / 60000;

    const zoomLink = await createZoomMeeting(title, startDate.toISOString(), duration);

    const newClass = new Class({
      title,
      trainer: trainerId,
      startTime: startDate,
      endTime: endDate,
      zoomLink,
    });

    const createdClass = await newClass.save();

    const populatedClass = await Class.findById(createdClass._id).populate('trainer', 'name');

    await User.updateMany(
      { role: 'student', status: 'paid' },
      { $push: { enrolledClasses: createdClass._id } }
    );

    res.status(201).json(populatedClass);
  } catch (error) {
    console.error('Error in scheduleClassForTrainer:', error.message);
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
};

// @desc   Get all scheduled classes
// @route  GET /api/admin/classes
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find({})
      .sort({ startTime: -1 })
      .populate('trainer', 'name email')
      .populate('batchId', 'name')
      .populate('studentIds', 'name email')
      .lean();

    const finalList = classes.map((cls) => ({
      ...cls,
      enrolledStudents: cls.studentIds || [],
      studentCount: cls.studentIds?.length || 0,
    }));

    res.json(finalList);
  } catch (error) {
    console.error('Get all classes error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc   Update class with a recording URL
// @route  PATCH /api/admin/classes/:id/recording
exports.updateClassRecording = async (req, res) => {
  try {
    const { recordingUrl } = req.body;
    const classToUpdate = await Class.findById(req.params.id);

    if (!classToUpdate) {
      return res.status(404).json({ message: 'Class not found' });
    }

    classToUpdate.recordingUrl = recordingUrl;
    await classToUpdate.save();

    res.json(classToUpdate);
  } catch (error) {
    console.error('Update class recording error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc   Create batch
// @route  POST /api/admin/batches
exports.createBatch = async (req, res) => {
  const { name, timing, course, trainerId, subjectAssignments, isActive } = req.body;

  try {
    if (name) {
      const batchExists = await Batch.findOne({ name });
      if (batchExists) {
        return res
          .status(409)
          .json({ message: 'A batch with this name already exists.' });
      }
    }

    let normalizedAssignments = [];
    if (Array.isArray(subjectAssignments)) {
      normalizedAssignments = subjectAssignments.map((row) => ({
        subject: row.subject || course || 'General',
        trainer: row.trainerId || row.trainer || undefined,
        timing: row.timing || timing || '',
      }));
    }

    let trainerField = undefined;
    if (trainerId) {
      const trainer = await User.findById(trainerId);
      if (!trainer || trainer.role !== 'trainer') {
        return res.status(404).json({
          message: 'Assigned trainer not found or is not a trainer.',
        });
      }
      trainerField = trainerId;
    }

    const newBatch = await Batch.create({
      name,
      timing,
      course: course || 'General',
      trainer: trainerField,
      subjectAssignments: normalizedAssignments,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    const createdBatch = await newBatch.populate('trainer', 'name email');
    res.status(201).json(createdBatch);
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ message: 'Server Error during batch creation.' });
  }
};

// @desc   Get all batches
// @route  GET /api/admin/batches
exports.getAllBatches = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status === 'active') filter.isActive = true;
    if (status === 'archived' || status === 'closed') filter.isActive = false;

    const batches = await Batch.find(filter).populate('trainer', 'name email');
    res.json(batches);
  } catch (error) {
    console.error('Get all batches error:', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch batches' });
  }
};

// @desc   Get batch details
// @route  GET /api/admin/batches/:id
exports.getBatchDetails = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id).populate('trainer', 'name email');

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found.' });
    }

    const now = new Date();
    const classes = await Class.find({ _id: { $in: batch.classes } }).sort({ startTime: -1 });

    const scheduledClasses = classes.filter((c) => c.endTime > now);
    const pastClasses = classes.filter((c) => c.endTime <= now);

    res.json({
      batch,
      scheduledClasses,
      pastClasses,
    });
  } catch (error) {
    console.error('Get batch details error:', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch batch details.' });
  }
};

// @desc   Update batch
// @route  PATCH /api/admin/batches/:id
exports.updateBatch = async (req, res) => {
  const { name, timing, course, trainerId, isActive, subjectAssignments } = req.body;

  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: 'Batch not found.' });
    }

    if (trainerId) {
      const trainer = await User.findById(trainerId);
      if (!trainer || trainer.role !== 'trainer') {
        return res.status(404).json({
          message: 'Assigned trainer not found or is not a trainer.',
        });
      }
      batch.trainer = trainerId;
    }

    if (name) batch.name = name;
    if (timing) batch.timing = timing;
    if (course) batch.course = course;
    if (typeof isActive === 'boolean') batch.isActive = isActive;

    if (Array.isArray(subjectAssignments)) {
      batch.subjectAssignments = subjectAssignments.map((row) => ({
        subject: row.subject || course || 'General',
        trainer: row.trainerId || row.trainer || undefined,
        timing: row.timing || '',
      }));
    }

    const updatedBatch = await batch.save();
    const populated = await updatedBatch.populate('trainer', 'name email');

    res.json(populated);
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({ message: 'Server Error during batch update.' });
  }
};

// @desc   Get live classes list
// @route  GET /api/admin/classes/live
exports.getLiveClassesList = async (req, res) => {
  try {
    const now = new Date();

    const liveClasses = await Class.find({
      startTime: { $lte: now },
      endTime: { $gte: now },
    })
      .populate('trainer', 'name')
      .select('title startTime endTime zoomLink trainer');

    const formattedClasses = liveClasses.map((cls) => ({
      id: cls._id,
      title: cls.title,
      trainer: cls.trainer ? cls.trainer.name : 'N/A',
      time: `${cls.startTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })} - ${cls.endTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      zoomLink: cls.zoomLink,
    }));

    res.json(formattedClasses);
  } catch (error) {
    console.error('Get live classes list error:', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch live classes list.' });
  }
};

// @desc   Get completed classes for a student
// @route  GET /api/admin/students/:id/completed-classes
exports.getStudentCompletedClasses = async (req, res) => {
  const studentId = req.params.id;
  const { startDate, endDate } = req.query;

  try {
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    let query = {
      _id: { $in: student.enrolledClasses },
      status: 'completed',
    };

    if (startDate) {
      query.startTime = { $gte: new Date(startDate) };
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.endTime = { ...(query.endTime || {}), $lte: endOfDay };
    }

    const completedClasses = await Class.find(query)
      .sort({ startTime: -1 })
      .populate('trainer', 'name')
      .populate('batchId', 'name course');

    const studentCourse = student.course || 'N/A';

    const formattedClasses = completedClasses.map((cls) => {
      const dateObj = new Date(cls.startTime);
      const endTimeObj = new Date(cls.endTime);
      const durationMs = endTimeObj.getTime() - dateObj.getTime();
      const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);

      return {
        id: cls._id,
        subject: studentCourse,
        classTitle: cls.title,
        topic: cls.title,
        date: dateObj.toLocaleDateString('en-IN'),
        time: `${dateObj.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })} - ${endTimeObj.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        day: dateObj.toLocaleDateString('en-IN', { weekday: 'long' }),
        trainer: cls.trainer ? cls.trainer.name : 'N/A',
        duration: `${durationHours} hrs`,
        batchName: cls.batchId ? cls.batchId.name : 'Individual',
        recordingUrl: cls.recordingUrl,
      };
    });

    res.json(formattedClasses);
  } catch (error) {
    console.error('Error fetching student completed classes:', error);
    res.status(500).json({ message: 'Server Error: Failed to fetch completed classes.' });
  }
};


exports.adminChangeStudentPassword = async (req, res) => {
  const studentId = req.params.id;
  const { newPassword, isTemporary } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: 'New password is required.' });
  }

  try {
    const student = await User.findById(studentId);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    student.password = hashed;
    student.isTemporaryPassword = !!isTemporary;

    await addPasswordHistoryEntry(student, hashed, {
      changedBy: req.user ? req.user._id : null,
      isTemporary: !!isTemporary,
    });

    await student.save();

    // ✅ Email the new password to the student
    try {
      await sendLoginCredentials(student.email, newPassword);
    } catch (emailErr) {
      console.error('Failed to send new password email:', emailErr);
      // don't fail the whole request just because email failed
    }

    // IMPORTANT: newPassword only sent in response ONCE; not stored as plaintext.
    res.json({
      message:
        'Student password updated successfully. The new password has been emailed to the student.',
      studentId: student._id,
      newPassword,
    });
  } catch (error) {
    console.error('Admin change student password error:', error);
    res.status(500).json({ message: 'Server Error: Failed to change password.' });
  }
};