// controllers/adminController.js
const User = require('../models/userModel');
const Class = require('../models/classModel');
const { createZoomMeeting } = require('../services/zoomService'); // MODIFIED: Import Zoom service
const { sendLoginCredentials } = require('../services/emailService');
const bcrypt = require('bcryptjs');



// @desc    Get dashboard stats

// @route   GET /api/admin/stats

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



// @desc    Get all students

// @route   GET /api/admin/students

exports.getAllStudents = async (req, res) => {

    try {

        const students = await User.find({ role: 'student' }).select('-password');

        res.json(students);

    } catch (error) {

        res.status(500).json({ message: 'Server Error' });

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

        // MODIFICATION START: If status is changed from 'pending' to 'paid'
        if (oldStatus === 'pending' && student.status === 'paid') {
            // Generate a random 8-character temporary password
            const temporaryPassword = Math.random().toString(36).slice(-8);
            
            // Hash the password before saving it to the database
            const salt = await bcrypt.genSalt(10);
            student.password = await bcrypt.hash(temporaryPassword, salt);
            
            console.log(`Generated temporary password for ${student.email}`);

            // Send the actual email with the plain-text temporary password
            await sendLoginCredentials(student.email, temporaryPassword);
        }
        // MODIFICATION END

        const updatedStudent = await student.save();
        res.json(updatedStudent);

    } catch (error) {
        console.error("Error updating student status:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};


// @desc    Create a new trainer profile

// @route   POST /api/admin/trainers

exports.createTrainer = async (req, res) => {
    // The password received from the form is the plain-text temporary password
    const { name, email, password } = req.body; 

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'Trainer with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        // Hash the plain-text password for secure storage
        const hashedPassword = await bcrypt.hash(password, salt);

        const trainer = await User.create({
            name,
            email,
            password: hashedPassword, // The hashed password goes to the DB
            role: 'trainer'
        });

        // 💡 FIX: Send the plain-text temporary password using the email service.
        // We use the original 'password' variable before it was hashed.
        console.log(`Sending login credentials to new trainer: ${email}`);
        await sendLoginCredentials(email, password);
        // 💡 END FIX

        res.status(201).json({
            _id: trainer._id,
            name: trainer.name,
            email: trainer.email,
            role: trainer.role,
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
// ✨ NEW: Delete Trainer Profile
// @desc    Delete a trainer
// @route   DELETE /api/admin/trainers/:id
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
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};