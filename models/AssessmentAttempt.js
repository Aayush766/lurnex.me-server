/**
 * AssessmentAttempt.js
 * Stores each candidate's quiz session and scored result.
 *
 * Status lifecycle:  started → submitted
 *                    started → abandoned  (when a new session supersedes an old one)
 */

const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedAnswer: { type: String, default: '' },
  },
  { _id: false }
);

const subjectAnalysisSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
  },
  { _id: false }
);

const assessmentAttemptSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Snapshot of candidate info at time of attempt (denormalised for lead reporting)
    candidate: {
      name: String,
      grade: String,
      school: String,
      address: String,
      city: String,
      country: String,
      mobile: String,
      email: String,
      parentEmail: String,
      curriculum: String,
    },

    answers: { type: [answerSchema], default: [] },
    // The order is created once per candidate, so every candidate receives a
    // different question sequence while a resumed session remains consistent.
    questionOrder: [{ type: mongoose.Schema.Types.ObjectId }],

    preferredSlot: { type: Date },
    slotBookedAt: { type: Date },

    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    subjectAnalysis: { type: [subjectAnalysisSchema], default: [] },

    status: {
      type: String,
      enum: ['started', 'submitted', 'abandoned'],
      default: 'started',
      index: true,
    },

    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },

    // Optional: track email delivery
    emailSentAt: { type: Date },
    emailError: { type: String },
  },
  {
    timestamps: true,      // adds createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for efficient student+assessment lookups
assessmentAttemptSchema.index({ student: 1, assessment: 1, status: 1 });
// Index for admin lead queries
assessmentAttemptSchema.index({ 'candidate.grade': 1, status: 1, createdAt: -1 });
assessmentAttemptSchema.index({ 'candidate.email': 1 });

module.exports = mongoose.model('AssessmentAttempt', assessmentAttemptSchema);
