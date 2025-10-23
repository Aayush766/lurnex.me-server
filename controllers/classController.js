// controllers/classController.js
const Class = require('../models/classModel');
const User = require('../models/userModel');

const getStudentClassIds = async (studentId) => {
    const student = await User.findById(studentId);
    if (!student) throw new Error('Student not found');
    return student.enrolledClasses;
};

// GET /api/classes/live
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
            trainer: cls.trainer.name,
            time: `${cls.startTime.toLocaleTimeString('en-IN')} - ${cls.endTime.toLocaleTimeString('en-IN')}`,
            zoomLink: cls.zoomLink
        }));
        res.json(formattedClasses);
    } catch (error) {
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// GET /api/classes/upcoming
exports.getUpcomingClasses = async (req, res) => {
    try {
        const now = new Date();
        const enrolledClassIds = await getStudentClassIds(req.user.id);

        const upcomingClasses = await Class.find({
            _id: { $in: enrolledClassIds },
            startTime: { $gt: now }
        }).sort({ startTime: 1 }).populate('trainer', 'name');

        const formattedClasses = upcomingClasses.map(cls => ({
            id: cls._id,
            title: cls.title,
            trainer: cls.trainer.name,
            date: cls.startTime.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric'}),
            time: cls.startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        }));
        res.json(formattedClasses);
    } catch (error) {
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

// GET /api/classes/past
exports.getPastClasses = async (req, res) => {
    try {
        const now = new Date();
        const enrolledClassIds = await getStudentClassIds(req.user.id);

        const pastClasses = await Class.find({
            _id: { $in: enrolledClassIds },
            endTime: { $lt: now }
        }).sort({ startTime: -1 }).populate('trainer', 'name');
        
        const formattedClasses = pastClasses.map(cls => ({
            id: cls._id,
            title: cls.title,
            date: cls.startTime.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric'}),
            recordingUrl: cls.recordingUrl
        }));
        res.json(formattedClasses);
    } catch (error) {
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};