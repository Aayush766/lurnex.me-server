// models/userModel.js
const mongoose = require('mongoose');

const passwordHistorySchema = new mongoose.Schema(
  {
    passwordHash: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin or user
    isTemporary: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    role: { type: String, enum: ['student', 'trainer', 'admin'], default: 'student' },

    status: { type: String, enum: ['paid', 'pending'], default: 'pending' },

    enrolledClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],

    isTemporaryPassword: {
      type: Boolean,
      default: false,
    },

    // Registration/Contact Info
    mobile: { type: String },
    course: { type: String },
    grade: { type: String },
    school: { type: String },

    // Trainer-specific info
    subject: { type: String }, // e.g. Math, Physics, etc.

    profilePictureUrl: { type: String },

    documents: [
      {
        url: { type: String, required: true },
        originalName: { type: String },
      },
    ],

    // STUDENT HOUR TRACKING FIELDS
    totalPaidHours: {
      type: Number,
      default: 0,
    },
    hoursHistory: {
      type: [
        {
          hours: { type: Number, required: true },
          date: { type: Date, required: true },
          notes: { type: String },
        },
      ],
      default: [],
    },

    // BATCH / ASSIGNMENT TRACKING
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    isOneOnOne: {
      type: Boolean,
      default: false,
    },

    // TRAINER STATS
    totalHoursTaught: {
      type: Number,
      default: 0,
    },
    teachingHistory: {
      type: [
        {
          hours: { type: Number, required: true },
          date: { type: Date, required: true },
          notes: { type: String },
          classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
        },
      ],
      default: [],
    },

    // PASSWORD HISTORY
    passwordHistory: {
      type: [passwordHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
