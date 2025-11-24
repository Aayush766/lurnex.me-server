// controllers/misController.js
const User = require('../models/userModel');
const Class = require('../models/classModel');
const Batch = require('../models/batchModel');
const { sendCancellationNotification } = require('../services/notificationService');

/**
 * Calculates the duration of a class in hours.
 */
const calculateDurationInHours = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    return Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
};

/**
 * @desc      Mark a class as 'completed' OR update completion details (remark) within 24 hours.
 *           - First time: processes hours and marks completed.
 *           - Later (within 24h): only updates remark.
 * @route     PATCH /api/mis/class/:id/complete
 * @access    Private/Admin
 */
exports.markClassCompleted = async (req, res) => {
    const { id } = req.params;
    const { remark } = req.body || {};

    try {
        const classToComplete = await Class.findById(id).populate('trainer', 'name email');
        
        if (!classToComplete) {
            return res.status(404).json({ message: 'Class not found.' });
        }

        const now = new Date();

        // --- If class already completed: only allow editing within 24h ---
        if (classToComplete.status === 'completed') {
            if (!classToComplete.completedAt) {
                return res.status(400).json({ message: 'This class is already marked as completed and cannot be edited.' });
            }

            const diffMs = now.getTime() - new Date(classToComplete.completedAt).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours > 24) {
                return res.status(400).json({ message: 'Completion details can only be edited within 24 hours.' });
            }

            classToComplete.remark = typeof remark === 'string' ? remark : classToComplete.remark;
            await classToComplete.save();

            return res.status(200).json({ message: 'Class completion details updated successfully.' });
        }

        // --- New completion: cannot mark before scheduled time ---
        if (now < new Date(classToComplete.startTime)) {
            return res.status(400).json({ message: 'Cannot mark class as completed before its scheduled start time.' });
        }

        const durationHours = calculateDurationInHours(classToComplete.startTime, classToComplete.endTime);
        if (durationHours <= 0) {
            return res.status(400).json({ message: 'Class duration is invalid. Cannot complete.' });
        }

        const trainerId = classToComplete.trainer?._id;
        let studentIds = [];

        // Get student IDs either from the class's studentIds array or from its batch
        if (classToComplete.studentIds && classToComplete.studentIds.length > 0) {
            studentIds = classToComplete.studentIds;
        } else if (classToComplete.batchId) {
            const batchStudents = await User.find({ batchId: classToComplete.batchId, role: 'student' }).select('_id');
            studentIds = batchStudents.map(s => s._id);
        }

        if (studentIds.length === 0) {
            return res.status(404).json({ message: 'No students found for this class.' });
        }

        // --- Process Students (Hours Deduction) ---
        const studentUpdates = studentIds.map(studentId => {
            const deductionEntry = {
                hours: -durationHours,
                date: new Date().toISOString(),
                notes: `Completed class: "${classToComplete.title}" (Class ID: ${id})`
            };

            return User.updateOne(
                { _id: studentId, role: 'student' },
                { 
                    $inc: { totalPaidHours: -durationHours },
                    $push: { hoursHistory: deductionEntry }
                }
            );
        });
        
        await Promise.all(studentUpdates);

        // --- Process Trainer (Hours Taught) ---
        if (trainerId) {
            const teachingEntry = {
                hours: durationHours,
                date: new Date().toISOString(),
                notes: `Taught class: "${classToComplete.title}" (Class ID: ${id})`,
                classId: id
            };

            await User.updateOne(
                { _id: trainerId, role: 'trainer' },
                {
                    $inc: { totalHoursTaught: durationHours },
                    $push: { teachingHistory: teachingEntry }
                }
            );
        }

        // --- Mark Class as Completed ---
        classToComplete.status = 'completed';
        classToComplete.remark = remark || '';
        classToComplete.completedAt = now; // for 24h edit
        await classToComplete.save();

        res.status(200).json({ 
            message: `Class marked as complete. ${durationHours} hours processed for ${studentIds.length} students and trainer ${classToComplete.trainer?.name || ''}.`
        });

    } catch (error) {
        console.error("Error marking class complete:", error);
        res.status(500).json({ message: 'Server Error: Failed to mark class as complete.' });
    }
};


/**
 * @desc      Mark a class as 'cancelled' OR update cancellation details within 24 hours.
 *           - First time: marks as cancelled and sends notifications.
 *           - Later (within 24h): only updates cancelledBy / reason.
 * @route     PATCH /api/mis/class/:id/cancel
 * @access    Private/Admin
 */
exports.markClassCancelled = async (req, res) => {
    const { id } = req.params;
    const { cancelledBy, reason } = req.body; // 'cancelledBy' (e.g., 'trainer', 'student', 'admin')

    if (!cancelledBy || !reason) {
        return res.status(400).json({ message: 'Cancellation party (cancelledBy) and reason are required.' });
    }

    try {
        const classToCancel = await Class.findById(id)
            .populate('trainer', 'name email');

        if (!classToCancel) {
            return res.status(404).json({ message: 'Class not found.' });
        }

        const now = new Date();

        // --- If already cancelled: allow editing within 24h ---
        if (classToCancel.status === 'cancelled') {
            if (!classToCancel.cancelledAt) {
                return res.status(400).json({ message: 'This class is already cancelled and cannot be edited.' });
            }

            const diffMs = now.getTime() - new Date(classToCancel.cancelledAt).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours > 24) {
                return res.status(400).json({ message: 'Cancellation details can only be edited within 24 hours.' });
            }

            classToCancel.cancellationReason = reason;
            classToCancel.cancelledBy = cancelledBy;
            await classToCancel.save();

            return res.status(200).json({ message: 'Class cancellation details updated successfully.' });
        }

        // --- New cancellation ---
        classToCancel.status = 'cancelled';
        classToCancel.cancellationReason = reason;
        classToCancel.cancelledBy = cancelledBy;
        classToCancel.cancelledAt = now; // for 24h edit
        await classToCancel.save();

        // --- Gather Emails for Notification ---
        let studentIds = [];
        if (classToCancel.studentIds && classToCancel.studentIds.length > 0) {
            studentIds = classToCancel.studentIds;
        } else if (classToCancel.batchId) {
            const batchStudents = await User.find({ batchId: classToCancel.batchId, role: 'student' }).select('_id');
            studentIds = batchStudents.map(s => s._id);
        }

        const students = await User.find({ _id: { $in: studentIds } }).select('name email');
        const trainer = classToCancel.trainer;

        // --- Send Notifications only on first cancellation ---
        await sendCancellationNotification(students, trainer, classToCancel, reason, cancelledBy);

        res.status(200).json({ message: 'Class marked as cancelled and notifications sent.' });

    } catch (error) {
        console.error("Error cancelling class:", error);
        res.status(500).json({ message: 'Server Error: Failed to cancel class.' });
    }
};


/**
 * @desc      Get a detailed history of all completed classes for MIS/Admin view
 * @route     GET /api/mis/trainer-history
 * @access    Private/Admin
 */
exports.getTrainerTeachingHistory = async (req, res) => {
    try {
        // Find all completed classes and populate trainer/student details
        const history = await Class.find({ status: 'completed' })
            .sort({ startTime: -1 }) // newest first
            .populate('trainer', 'name') // trainer name
            .populate('studentIds', 'name email totalPaidHours'); 

        // Reformat data for clean table view
        const formattedHistory = history.map(cls => {
            const durationInHours = calculateDurationInHours(cls.startTime, cls.endTime);

            return {
                id: cls._id,
                title: cls.title,
                date: cls.startTime.toISOString().split('T')[0],
                trainerName: cls.trainer ? cls.trainer.name : 'N/A',
                duration: durationInHours,
                students: cls.studentIds.map(student => ({
                    id: student._id,
                    name: student.name,
                    email: student.email,
                    hoursRemaining: student.totalPaidHours
                })),
            };
        });

        res.status(200).json(formattedHistory);

    } catch (error) {
        console.error("Error fetching trainer teaching history:", error);
        res.status(500).json({ message: 'Server Error: Failed to fetch teaching history.' });
    }
};


/**
 * @desc      Get key statistics for the MIS dashboard.
 * @route     GET /api/mis/stats
 * @access    Private/Admin
 */
exports.getMisDashboardStats = async (req, res) => {
    try {
        // Trainer stats
        const trainerStats = await User.aggregate([
            { $match: { role: 'trainer' } },
            { $group: {
                _id: null,
                totalTrainers: { $sum: 1 },
                totalHoursTaught: { $sum: '$totalHoursTaught' }
            }}
        ]);

        // Student stats (only paid/active)
        const studentStats = await User.aggregate([
            { $match: { role: 'student', status: 'paid' } },
            { $group: {
                _id: null,
                totalActiveStudents: { $sum: 1 },
                totalHoursRemaining: { $sum: '$totalPaidHours' }
            }}
        ]);

        // Class stats by status
        const classStats = await Class.aggregate([
            { $group: {
                _id: '$status', // 'scheduled', 'completed', 'cancelled'
                count: { $sum: 1 }
            }}
        ]);

        const formattedClassStats = classStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
        }, { scheduled: 0, completed: 0, cancelled: 0 });

        const stats = {
            totalActiveStudents: studentStats[0]?.totalActiveStudents || 0,
            totalHoursRemaining: studentStats[0]?.totalHoursRemaining || 0,
            totalTrainers: trainerStats[0]?.totalTrainers || 0,
            totalHoursTaught: trainerStats[0]?.totalHoursTaught || 0,
            classesCompleted: formattedClassStats.completed,
            classesScheduled: formattedClassStats.scheduled,
            classesCancelled: formattedClassStats.cancelled
        };

        res.status(200).json(stats);

    } catch (error) {
        console.error("Error fetching MIS stats:", error);
        res.status(500).json({ message: 'Server Error: Failed to fetch MIS stats.' });
    }
};
