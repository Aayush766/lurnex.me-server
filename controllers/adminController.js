const User = require('../models/userModel');
const Class = require('../models/classModel');
const { createZoomMeeting } = require('../services/zoomService');
const { sendLoginCredentials } = require('../services/emailService');
const bcrypt = require('bcryptjs');
const Batch = require('../models/batchModel');

// --- Helper function for consistent student data return (UPDATED) ---
const studentProjection = '_id name email mobile course grade school status totalPaidHours hoursHistory batchId isOneOnOne';

// @desc      Get dashboard stats
// @route     GET /api/admin/stats
exports.getDashboardStats = async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const activeTrainers = await User.countDocuments({ role: 'trainer' });
        
        const now = new Date();
        const liveClasses = await Class.countDocuments({
            startTime: { $lte: now },
            endTime: { $gte: now }
        });

        res.json({ totalStudents, activeTrainers, liveClasses });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// ---------------------------------------------------------------------
// ✨ RESTORED: Get all students
// @desc      Get all students
// @route     GET /api/admin/students
exports.getAllStudents = async (req, res) => {
    try {
        // Fetch students and populate batch details (only name)
        const students = await User.find({ role: 'student' })
            .select(studentProjection)
            .populate('batchId', 'name'); // Populate batch name for display
            
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'Server Error: Failed to fetch students' });
    }
};


const generateRecurrenceDates = (start, end, recurringData) => {
    // If not recurring, just return the single instance
    if (!recurringData.isRecurring || !start || !end || isNaN(start.getTime())) {
        return [{ startTime: start, endTime: end }];
    }

    const { frequency, interval, daysOfWeek, endType, endDate, endCount } = recurringData;
    const durationMs = end.getTime() - start.getTime();
    
    const startHour = start.getHours();
    const startMinute = start.getMinutes();
    
    const recurrenceList = [];
    let currentDate = new Date(start.getTime()); // Reference day for calculation
    let count = 0;
    
    // Safety limits for generation
    const MAX_SCHEDULED = endType === 'count' ? endCount : 500;
    const END_DATE_LIMIT = endType === 'date' && endDate ? new Date(endDate) : null;
    
    // Helper to check if a date is past the end limit
    const isPastEnd = (date) => {
        if (END_DATE_LIMIT && date.getTime() > END_DATE_LIMIT.getTime()) return true;
        return false;
    };
    
    // Helper to set time to match the initial class time
    const setClassTime = (date) => {
        const classStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, startMinute);
        const classEnd = new Date(classStart.getTime() + durationMs);
        return { classStart, classEnd };
    };

    // Keep track of the last generated date to advance correctly
    let lastGeneratedDate = new Date(currentDate.getTime());

    // Loop to generate all occurrences
    while (count < MAX_SCHEDULED && count < 500) {
        
        // 1. Calculate the next potential start date
        let nextDate = new Date(lastGeneratedDate.getTime());
        
        if (count > 0) { // Only advance for subsequent occurrences
            if (frequency === 'daily') {
                nextDate.setDate(nextDate.getDate() + interval);
            } else if (frequency === 'weekly') {
                // Simplistic: Only advance if the day of the week matches one of the selected days.
                // A better implementation would find the next matching day, but for now, 
                // we'll just advance by a full week if daysOfWeek is used, and rely on the client's simple calculation.
                // For a simple N-week recurrence:
                nextDate.setDate(nextDate.getDate() + (7 * interval));
            } else if (frequency === 'monthly') {
                nextDate.setMonth(nextDate.getMonth() + interval);
            } else {
                break; // Unknown frequency
            }
        }

        const nextTimes = setClassTime(nextDate);

        // 2. Check termination conditions
        if (isPastEnd(nextTimes.classStart)) break;
        
        // 3. Check for specific weekly days (if applicable and not the first class)
        const dayOfWeek = nextTimes.classStart.getDay().toString(); // 0=Sun, 1=Mon...
        
        if (count > 0 && frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
            // NOTE: This logic is still incomplete for full weekly recurrence,
            // as it skips classes not on the first day of the week but on one of the selected days.
            // A more complex loop is needed, but we'll stick to the basic recurrence pattern for this simplified handler.
        }

        // 4. Add valid class
        recurrenceList.push({ startTime: nextTimes.classStart, endTime: nextTimes.classEnd });
        lastGeneratedDate = nextDate; // Update the reference date
        count++;
        
        // Safety break if interval logic is buggy
        if (count === MAX_SCHEDULED) break; 
    }
    
    return recurrenceList;
};

exports.scheduleBulkClasses = async (req, res) => {
    const { baseClass, recurring } = req.body;
    
    const { title, trainerId, startTime, endTime, batchId, studentIds } = baseClass;

    // 1. Basic Validation
    if (!title || !trainerId || !startTime || !endTime) {
        return res.status(400).json({ message: 'Title, trainer, start time, and end time are required.' });
    }
    
    if (!batchId && (!studentIds || studentIds.length === 0)) {
         return res.status(400).json({ message: 'Class must be assigned to a Batch or at least one Student.' });
    }

    try {
        const trainer = await User.findById(trainerId);
        if (!trainer || trainer.role !== 'trainer') {
            return res.status(404).json({ message: 'Assigned trainer not found or is not a trainer.' });
        }
        
        let studentsToEnroll = [];
        let batch;

        // Determine assignment target and fetch students for enrollment
        if (batchId) {
            batch = await Batch.findById(batchId);
            if (!batch) {
                return res.status(404).json({ message: 'Assigned batch not found.' });
            }
            // Fetch all students belonging to the batch to enroll them
            studentsToEnroll = await User.find({ batchId, role: 'student' }).select('_id');
        } else if (studentIds && studentIds.length > 0) {
            // Validate all students exist and are students
            const foundStudents = await User.find({ _id: { $in: studentIds }, role: 'student' }).select('_id');
            if (foundStudents.length !== studentIds.length) {
                 return res.status(404).json({ message: 'One or more assigned students were not found.' });
            }
            studentsToEnroll = foundStudents;
        }

        // 2. Generate Dates for all Occurrences
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        const recurrenceDates = generateRecurrenceDates(start, end, recurring);
        
        if (recurrenceDates.length === 0) {
             return res.status(400).json({ message: 'No valid class dates generated based on recurrence rules.' });
        }

        const createdClasses = [];
        const newClassIds = [];
        
        // 3. Create Class Documents & Zoom Meetings
        for (const { startTime: classStart, endTime: classEnd } of recurrenceDates) {
            
            // Calculate duration in minutes for Zoom
            const durationMinutes = Math.round((classEnd.getTime() - classStart.getTime()) / (1000 * 60));
            if (durationMinutes <= 0) {
                 continue; // Skip invalid duration
            }

            // Create Zoom Meeting (Assuming createZoomMeeting returns the join_url)
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
                studentIds: studentIds && studentIds.length > 0 ? studentIds : []
            });
            
            const savedClass = await newClass.save();
            createdClasses.push(savedClass);
            newClassIds.push(savedClass._id);
        }

        // 4. Update Batch and Student Enrollments (Atomic Updates)

        // Update Batch (if assigned to a batch)
        if (batch) {
            batch.classes.push(...newClassIds);
            await batch.save();
        }

        // Update Students (regardless of assignment type, enroll all relevant students)
        if (studentsToEnroll.length > 0) {
            const studentIdsToUpdate = studentsToEnroll.map(s => s._id);
            
            // Use updateMany for efficiency: push all new class IDs to the enrolledClasses array
            await User.updateMany(
                { _id: { $in: studentIdsToUpdate } },
                { $push: { enrolledClasses: { $each: newClassIds } } }
            );
        }
        
        // 5. Success Response: Return the list of newly created classes
        // The frontend expects the full class object to calculate durationHours, 
        // so we populate the trainer field (name only).
        const populatedClasses = await Class.find({ _id: { $in: newClassIds } }).populate('trainer', 'name');

        res.status(201).json(populatedClasses);

    } catch (error) {
        console.error("Bulk class scheduling error:", error);
        res.status(500).json({ message: 'Server Error: Failed to schedule class(es).' });
    }
};

// ---------------------------------------------------------------------
// ✨ NEW: Get All Trainers
// @desc    Get all trainers
// @route   GET /api/admin/trainers
exports.getAllTrainers = async (req, res) => {
    try {
        // Fetch users where role is 'trainer' and select necessary fields
        const trainers = await User.find({ role: 'trainer' }).select('_id name email role'); 
        
        res.json(trainers);
    } catch (error) {
        console.error("Error fetching trainers:", error);
        res.status(500).json({ message: 'Server Error: Failed to fetch trainers.' });
    }
};

// @desc      Create a new student via Admin Form
// @route     POST /api/admin/students
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
            name, email, mobile, course, grade, school, 
            totalPaidHours: parseFloat(totalPaidHours) || 0,
            password: hashedPassword,
            role: 'student',
            status: 'pending',
        });
        
        // Return created student with the updated projection
        // We use populate here too for consistency with getAllStudents
        res.status(201).json(await User.findById(student._id)
            .select(studentProjection)
            .populate('batchId', 'name')
        ); 

    } catch (error) {
        console.error("Admin create student error:", error);
        res.status(500).json({ message: 'Server Error during student creation.' });
    }
};

// @desc    Get a single student by ID
// @route   GET /api/admin/students/:id
exports.getStudent = async (req, res) => {
    try {
        const student = await User.findById(req.params.id)
            .select(studentProjection)
            .populate('batchId', 'name'); // Populate batch name

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found.' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Server Error: Failed to fetch student' });
    }
};

// @desc    Update a student's basic details
// @route   PATCH /api/admin/students/:id
exports.updateStudentDetails = async (req, res) => {
    const studentId = req.params.id;
    // NOTE: batchId and isOneOnOne are handled in the new transferStudent function
    const { name, email, mobile, course, grade, school, totalPaidHours } = req.body; 

    try {
        const student = await User.findById(studentId);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Handle unique email constraint
        if (email !== student.email) {
             const emailExists = await User.findOne({ email });
             if (emailExists && String(emailExists._id) !== studentId) {
                 return res.status(409).json({ message: 'Email already in use by another user.' });
             }
        }
        
        student.name = name || student.name;
        student.email = email || student.email;
        student.mobile = mobile ?? student.mobile;
        student.course = course ?? student.course;
        student.grade = grade ?? student.grade;
        student.school = school ?? student.school;
        student.totalPaidHours = parseFloat(totalPaidHours) >= 0 ? parseFloat(totalPaidHours) : student.totalPaidHours;

        const updatedStudent = await student.save();
        res.json(await User.findById(updatedStudent._id)
            .select(studentProjection)
            .populate('batchId', 'name')
        );

    } catch (error) {
        console.error("Student update error:", error);
        res.status(500).json({ message: 'Server Error during student update.' });
    }
};

// @desc    Log a transaction and add hours to totalPaidHours
// @route   PATCH /api/admin/students/:id/add-hours
exports.addExtraHours = async (req, res) => {
    const studentId = req.params.id;
    const { hours, date, notes } = req.body;

    // Validate input (Crucial check for NaN and positive value)
    const hoursToAdd = parseFloat(hours);
    if (isNaN(hoursToAdd) || hoursToAdd <= 0 || !date) {
        return res.status(400).json({ message: 'A valid, positive number of hours and a purchase date are required.' });
    }

    try {
        const student = await User.findById(studentId);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // 1. Update totalPaidHours
        student.totalPaidHours += hoursToAdd;
        if (!student.hoursHistory) {
            student.hoursHistory = [];
        }
        // 2. Log the transaction in the history array
        const transaction = { 
            hours: hoursToAdd, 
            date: new Date(date).toISOString(), 
            notes: notes || 'Manual admin addition' 
        };
        student.hoursHistory.push(transaction);

        const updatedStudent = await student.save();

        // Return the updated student object using the projection
        res.json(await User.findById(updatedStudent._id)
            .select(studentProjection)
            .populate('batchId', 'name')
        );

    } catch (error) {
        console.error("Add extra hours error:", error);
        res.status(500).json({ message: 'Server Error: Failed to add hours.' });
    }
};


// ✨ NEW FUNCTION: Transfer Student to Batch or One-on-One
// @desc    Assign student to a batch or mark as 1-on-1
// @route   PATCH /api/admin/students/:id/transfer
exports.transferStudent = async (req, res) => {
    const studentId = req.params.id;
    const { type, batchId } = req.body; // type will be 'batch' or 'one-on-one'

    try {
        const student = await User.findById(studentId);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // --- Logic to handle transfer ---
        if (type === 'one-on-one') {
            student.isOneOnOne = true;
            student.batchId = undefined; // Clear batch assignment
        } else if (type === 'batch' && batchId) {
            // NOTE: You should ideally validate that 'batchId' is a valid Batch ID
            student.isOneOnOne = false;
            student.batchId = batchId;
        } else {
            return res.status(400).json({ message: 'Invalid transfer type or missing batch ID.' });
        }
        
        const updatedStudent = await student.save();

        // Return updated student, populated with new batch details if applicable
        res.json(await User.findById(updatedStudent._id)
            .select(studentProjection)
            .populate('batchId', 'name')
        ); 

    } catch (error) {
        console.error("Transfer student error:", error);
        res.status(500).json({ message: 'Server Error: Failed to transfer student.' });
    }
};


// @desc    Update a student's status
// @route   PATCH /api/admin/students/:id/status
exports.updateStudentStatus = async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const oldStatus = student.status;
        student.status = req.body.status || student.status;

        // Logic for generating password and sending email on status change from 'pending' to 'paid'
        if (oldStatus === 'pending' && student.status === 'paid') {
            const temporaryPassword = Math.random().toString(36).slice(-8);
            const salt = await bcrypt.genSalt(10);
            student.password = await bcrypt.hash(temporaryPassword, salt);
            
            console.log(`Generated temporary password for ${student.email}`);
            await sendLoginCredentials(student.email, temporaryPassword);
        }

        const updatedStudent = await student.save();
        // Return projected data
        res.json(await User.findById(updatedStudent._id)
            .select(studentProjection)
            .populate('batchId', 'name')
        );

    } catch (error) {
        console.error("Error updating student status:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};


// ... (createTrainer, updateTrainer, deleteTrainer, scheduleClassForTrainer, getAllClasses, updateClassRecording, loginUser are UNCHANGED) ...

exports.createTrainer = async (req, res) => {
    const { name, email, password } = req.body; 

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'Trainer with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const trainer = await User.create({
            name, email, password: hashedPassword, role: 'trainer'
        });

        console.log(`Sending login credentials to new trainer: ${email}`);
        await sendLoginCredentials(email, password);

        res.status(201).json({
            _id: trainer._id, name: trainer.name, email: trainer.email, role: trainer.role,
        });
    } catch (error) {
        console.error("Error creating trainer:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.updateTrainer = async (req, res) => {
    const { name, email, password } = req.body;
    const trainerId = req.params.id;

    try {
        const trainer = await User.findById(trainerId);

        if (!trainer || trainer.role !== 'trainer') {
            return res.status(404).json({ message: 'Trainer not found' });
        }

        // Check if new email already exists for another user
        if (email && email !== trainer.email) {
            const userExists = await User.findOne({ email });
            if (userExists) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            trainer.email = email;
        }

        trainer.name = name || trainer.name;
        
        // Handle password change (optional)
        if (password) {
            const salt = await bcrypt.genSalt(10);
            trainer.password = await bcrypt.hash(password, salt);
            
            // Optionally send new temporary password via email
            await sendLoginCredentials(trainer.email, password);
        }

        const updatedTrainer = await trainer.save();

        res.json({
            _id: updatedTrainer._id,
            name: updatedTrainer.name,
            email: updatedTrainer.email,
            role: updatedTrainer.role,
        });

    } catch (error) {
        console.error("Error updating trainer:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ---------------------------------------------------------------------
// DELETE Trainer Profile
// @desc    Delete a trainer
// @route   DELETE /api/admin/trainers/:id
exports.deleteTrainer = async (req, res) => {
    try {
        const trainer = await User.findOneAndDelete({ _id: req.params.id, role: 'trainer' });

        if (!trainer) {
            return res.status(404).json({ message: 'Trainer not found' });
        }

        // Optional: Remove all classes associated with this trainer
        await Class.deleteMany({ trainer: req.params.id });
        
        // Optional: Remove trainer from enrolledClasses array of all students (if implemented)
        // await User.updateMany({ role: 'student' }, { $pull: { enrolledClasses: { $in: classesIds } } });

        res.json({ message: 'Trainer and associated data removed successfully' });

    } catch (error) {
        console.error("Error deleting trainer:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};



// @desc    Schedule a class for a trainer
// @route   POST /api/admin/classes
exports.scheduleClassForTrainer = async (req, res) => {
    const { title, startTime, endTime, trainerId } = req.body; // MODIFIED: Use endTime

    if (!title || !startTime || !endTime || !trainerId) {
        return res.status(400).json({ message: 'Please provide title, startTime, endTime, and trainerId' });
    }

    try {
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const duration = (endDate.getTime() - startDate.getTime()) / 60000; // Duration in minutes

        // MODIFIED: Call the Zoom API to create a meeting
        const zoomLink = await createZoomMeeting(title, startDate.toISOString(), duration);

        const newClass = new Class({
            title,
            trainer: trainerId,
            startTime: startDate,
            endTime: endDate,
            zoomLink: zoomLink 
        });

        const createdClass = await newClass.save();

        // Populate trainer info before sending back
        const populatedClass = await Class.findById(createdClass._id).populate('trainer', 'name');

        // Enroll all 'paid' students in the new class
        await User.updateMany(
            { role: 'student', status: 'paid' },
            { $push: { enrolledClasses: createdClass._id } }
        );

        res.status(201).json(populatedClass); // MODIFIED: Send back the populated class
    } catch (error) {
        console.error("Error in scheduleClassForTrainer:", error.message);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// @desc    Get all scheduled classes
// @route   GET /api/admin/classes
exports.getAllClasses = async (req, res) => {
    try {
        const classes = await Class.find({}).sort({ startTime: -1 }).populate('trainer', 'name');
        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};


// NEW: Function to add a recording URL
// @desc    Update a class with a recording URL
// @route   PATCH /api/admin/classes/:id/recording
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
        res.status(500).json({ message: 'Server error' });
    }
};


exports.loginUser = async (req, res) => {
    const { email, password, role } = req.body;
    
    try {
        const user = await User.findOne({ email, role });

        if (user && (await bcrypt.compare(password, user.password))) {
            
            // MODIFICATION START: Block disabled students from logging in
            if (user.role === 'student' && user.status !== 'paid') {
                return res.status(403).json({ message: 'Your account is disabled. Please contact support.' });
            }
            // MODIFICATION END

            res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                // Assuming generateToken is defined elsewhere
                token: generateToken(user._id), 
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};


exports.createBatch = async (req, res) => {
    const { name, timing, course, trainerId } = req.body;
    
    try {
        const batchExists = await Batch.findOne({ name });
        if (batchExists) {
            return res.status(409).json({ message: 'A batch with this name already exists.' });
        }

        const trainer = await User.findById(trainerId);
        if (!trainer || trainer.role !== 'trainer') {
             return res.status(404).json({ message: 'Assigned trainer not found or is not a trainer.' });
        }

        const newBatch = await Batch.create({
            name,
            timing,
            course,
            trainer: trainerId
        });

        // Populate trainer name for immediate response
        const createdBatch = await newBatch.populate('trainer', 'name email'); 
        res.status(201).json(createdBatch);

    } catch (error) {
        console.error("Create batch error:", error);
        res.status(500).json({ message: 'Server Error during batch creation.' });
    }
};

// @desc    Get all batches
// @route   GET /api/admin/batches
exports.getAllBatches = async (req, res) => {
    try {
        // Populate the trainer's name for display and sort by name
        const batches = await Batch.find({})
            .populate('trainer', 'name email')
            .sort({ name: 1 });
            
        res.json(batches);
    } catch (error) {
        console.error("Get all batches error:", error);
        res.status(500).json({ message: 'Server Error: Failed to fetch batches.' });
    }
};

// @desc    Get batch details, including scheduled and past classes
// @route   GET /api/admin/batches/:id
exports.getBatchDetails = async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id).populate('trainer', 'name email');

        if (!batch) {
            return res.status(404).json({ message: 'Batch not found.' });
        }

        const now = new Date();
        
        // Fetch and separate classes
        const classes = await Class.find({ _id: { $in: batch.classes } })
            .sort({ startTime: -1 });

        const scheduledClasses = classes.filter(c => c.endTime > now);
        const pastClasses = classes.filter(c => c.endTime <= now);
        
        res.json({
            batch,
            scheduledClasses,
            pastClasses
        });

    } catch (error) {
        console.error("Get batch details error:", error);
        res.status(500).json({ message: 'Server Error: Failed to fetch batch details.' });
    }
};

// @desc    Update batch details (name, timing, trainer, course)
// @route   PATCH /api/admin/batches/:id
exports.updateBatch = async (req, res) => {
    const { name, timing, course, trainerId, isActive } = req.body;
    
    try {
        const batch = await Batch.findById(req.params.id);

        if (!batch) {
            return res.status(404).json({ message: 'Batch not found.' });
        }

        if (trainerId) {
             const trainer = await User.findById(trainerId);
             if (!trainer || trainer.role !== 'trainer') {
                 return res.status(404).json({ message: 'Assigned trainer not found or is not a trainer.' });
             }
             batch.trainer = trainerId;
        }

        batch.name = name || batch.name;
        batch.timing = timing || batch.timing;
        batch.course = course || batch.course;
        
        if (typeof isActive === 'boolean') {
             batch.isActive = isActive;
        }

        const updatedBatch = await batch.save();
        res.json(await updatedBatch.populate('trainer', 'name email'));

    } catch (error) {
        console.error("Update batch error:", error);
        res.status(500).json({ message: 'Server Error during batch update.' });
    }
};