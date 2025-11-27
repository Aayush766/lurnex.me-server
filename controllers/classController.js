// controllers/classController.js
const Class = require('../models/classModel');
const User = require('../models/userModel');

// ---------- Helper: Get student's enrolled class IDs ----------
const getStudentClassIds = async (studentId) => {
    const student = await User.findById(studentId);
    if (!student) throw new Error('Student not found');
    return student.enrolledClasses;
};

// ============================================================================
// STUDENT: Live Classes
// GET /api/classes/live
// ============================================================================
exports.getLiveClasses = async (req, res) => {
    try {
        const now = new Date();
        const enrolledClassIds = await getStudentClassIds(req.user.id);
        
        const liveClasses = await Class.find({
            _id: { $in: enrolledClassIds },
            startTime: { $lte: now },
            endTime: { $gte: now }
        }).populate('trainer', 'name');
        
        const formattedClasses = liveClasses.map(cls => ({
            id: cls._id,
            title: cls.title,
            trainer: cls.trainer?.name || 'Unknown',
            // 🔁 same style as your working code
            time: `${cls.startTime.toLocaleTimeString('en-IN')} - ${cls.endTime.toLocaleTimeString('en-IN')}`,
            zoomLink: cls.zoomLink
        }));
        res.json(formattedClasses);
    } catch (error) {
        console.error('Error in getLiveClasses:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// ============================================================================
// STUDENT: Upcoming Classes
// GET /api/classes/upcoming
// ============================================================================
exports.getUpcomingClasses = async (req, res) => {
    try {
        const now = new Date();
        const enrolledClassIds = await getStudentClassIds(req.user.id);

        const upcomingClasses = await Class.find({
            _id: { $in: enrolledClassIds },
            startTime: { $gt: now }
        })
            .sort({ startTime: 1 })
            .populate('trainer', 'name');

        const formattedClasses = upcomingClasses.map(cls => ({
            id: cls._id,
            title: cls.title,
            trainer: cls.trainer?.name || 'Unknown',
            date: cls.startTime.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }),
            time: cls.startTime.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
            }),
        }));
        res.json(formattedClasses);
    } catch (error) {
        console.error('Error in getUpcomingClasses:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// ============================================================================
// STUDENT: Past Classes
// GET /api/classes/past
// ============================================================================
exports.getPastClasses = async (req, res) => {
    try {
        const now = new Date();
        const enrolledClassIds = await getStudentClassIds(req.user.id);

        const pastClasses = await Class.find({
            _id: { $in: enrolledClassIds },
            endTime: { $lt: now }
        })
            .sort({ startTime: -1 })
            .populate('trainer', 'name');
        
        const formattedClasses = pastClasses.map(cls => ({
            id: cls._id,
            title: cls.title,
            date: cls.startTime.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }),
            recordingUrl: cls.recordingUrl,
        }));
        res.json(formattedClasses);
    } catch (error) {
        console.error('Error in getPastClasses:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// ============================================================================
// TRAINER: All Their Classes (for ManageClasses.jsx)
// GET /api/classes/trainer
// ============================================================================
exports.getTrainerClasses = async (req, res) => {
    try {
        const trainerId = req.user.id; // from protect middleware

        const classes = await Class.find({
            trainer: trainerId,
            status: { $ne: 'cancelled' }, // optional: hide cancelled
        })
            .sort({ startTime: 1 })
            .populate('trainer', 'name');

        // For trainer, send raw startTime/endTime for frontend categorization
        const formatted = classes.map((cls) => ({
            _id: cls._id,
            title: cls.title,
            startTime: cls.startTime,        // frontend does new Date(cls.startTime)
            endTime: cls.endTime,
            zoomLink: cls.zoomLink,
            studentsEnrolled: Array.isArray(cls.studentIds)
                ? cls.studentIds.length
                : 0,
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Error in getTrainerClasses:', error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};
