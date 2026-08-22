/**
 * AssessmentModel.js
 */

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true, trim: true, maxlength: 2000 },
    options: {
      type: [String],
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 2 && v.length <= 6,
        message: 'Each question must have 2–6 options.',
      },
    },
    correctAnswer: { type: String, required: true, trim: true },
    subject: { type: String, default: 'Overall', trim: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    explanation: { type: String, default: '', maxlength: 1000 },
    marks: { type: Number, default: 1, min: 1 },  // reserved for weighted scoring
  },
  { _id: true }
);

// Ensure correctAnswer is one of the options
questionSchema.pre('validate', function () {
  if (this.options && this.correctAnswer && !this.options.includes(this.correctAnswer)) {
    this.invalidate('correctAnswer', 'Correct answer must match one of the provided options.');
  }
});

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    duration: { type: Number, required: true, min: 1, max: 300 }, // minutes
    targetGrades: { type: [String], default: [] }, // empty array = all grades
    isPublished: { type: Boolean, default: false, index: true },
    questions: { type: [questionSchema], default: [] },
    passingPercentage: { type: Number, default: 60, min: 0, max: 100 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin who created it
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Virtual: number of questions
assessmentSchema.virtual('questionCount').get(function () {
  return this.questions.length;
});

module.exports = mongoose.model('Assessment', assessmentSchema);