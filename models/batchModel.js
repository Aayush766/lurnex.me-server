// models/batchModel.js
const mongoose = require('mongoose');

const subjectAssignmentSchema = new mongoose.Schema(
  {
    subject: { type: String }, // e.g. Math / Science (optional)
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // trainer user
    },
    timing: { type: String }, // e.g. "Mon/Wed 7–8 PM"
  },
  { _id: false }
);

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      // ⛔ if you really want *everything* optional, remove required below too
      required: true,
      unique: true,
      trim: true,
    },
    timing: {
      type: String,
      // was required: true –> now optional
    },
    course: {
      type: String,
      // was required: true –> now optional with default
      default: 'General',
    },
    // OLD single trainer (still kept for backward compatibility)
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // was required: true –> now optional
    },

    // ✅ NEW: multiple subject-wise trainers & timings
    subjectAssignments: [subjectAssignmentSchema],

    // Array of class IDs associated with this batch
    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Batch', batchSchema);
