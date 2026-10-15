const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: String, required: true }, // e.g., "92%" or "85/100"
    submittedOn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Submission', submissionSchema);