const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    duration: { type: Number, required: true }, // Duration in minutes
    questions: [
        {
            questionText: String,
            options: [String],
            correctAnswer: String
        }
    ]
});

module.exports = mongoose.model('Assessment', assessmentSchema);