const Assessment = require('../models/AssessmentModel');
const Submission = require('../models/submissionModel');

// GET /api/assessments/available
exports.getAvailableAssessments = async (req, res) => {
    try {
        // Find assessments that the student has NOT submitted yet
        const completedSubs = await Submission.find({ student: req.user.id }).select('assessment');
        const completedIds = completedSubs.map(sub => sub.assessment);

        const available = await Assessment.find({ _id: { $nin: completedIds } });

        // Format data to match the frontend component
        const formatted = available.map(a => ({
            id: a._id,
            title: a.title,
            questions: a.questions.length,
            duration: a.duration
        }));

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// GET /api/assessments/completed
exports.getCompletedAssessments = async (req, res) => {
    try {
        const completed = await Submission.find({ student: req.user.id }).populate('assessment', 'title');
        
        // Format data
        const formatted = completed.map(sub => ({
            id: sub._id,
            title: sub.assessment.title,
            score: sub.score,
            date: sub.submittedOn.toISOString().split('T')[0]
        }));
        
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};