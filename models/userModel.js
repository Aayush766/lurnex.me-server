// models/userModel.js
const mongoose = require('mongoose');

<<<<<<< HEAD
const leadSources = [
  'course_enrollment',
  'assessment_enrollment',
  'syllabus_enrollment',
  'internal_assessment_enrollment',
  'resource_download',
  'resource_request',
  'brochure_request',
  'expert_callback',
  'counselling_request',
];

=======
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
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
<<<<<<< HEAD
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: false, select: false },
    accountRegistration: { type: Boolean, default: false },
    isLead: { type: Boolean, default: false, index: true },
    emailVerified: { type: Boolean, default: false },
    accountStatus: { type: String, enum: ['pending', 'active', 'suspended'], default: 'active' },
    linkedAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    parentName: { type: String, trim: true },
    parentEmail: { type: String, trim: true, lowercase: true },
    parentMobile: { type: String, trim: true },
    curriculum: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    verificationCodeHash: { type: String, select: false },
    verificationCodeExpiresAt: { type: Date, select: false },
    verificationAttempts: { type: Number, default: 0, select: false },
    resetCodeHash: { type: String, select: false },
    resetCodeExpiresAt: { type: Date, select: false },
    resetAttempts: { type: Number, default: 0, select: false },
=======
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86

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
    previousGrade: { type: String },
    school: { type: String },
    address: { type: String },
    city: { type: String },
    country: { type: String },

    // Tracks which page/source the student registered from
    registeredFrom: { type: String, default: 'Unknown' },
<<<<<<< HEAD
    leadSource: { type: String, enum: leadSources },
    leadIntent: { type: String, trim: true },
    leadType: { type: String, enum: ['general', 'sat_masterclass'], default: 'general', index: true },
    satParentName: { type: String, trim: true, maxlength: 120 },
    satFocus: { type: String, enum: ['Math', 'Reading & Writing', 'Both'] },
    satPreferredSession: { type: String, enum: ['October 24', 'October 31', 'Both'] },
    satTargetDate: { type: String, trim: true, maxlength: 40 },
    satAttribution: {
      utmSource: { type: String, trim: true, maxlength: 200 },
      utmMedium: { type: String, trim: true, maxlength: 200 },
      utmCampaign: { type: String, trim: true, maxlength: 200 },
      utmTerm: { type: String, trim: true, maxlength: 200 },
      utmContent: { type: String, trim: true, maxlength: 200 },
    },
    registrationUrl: { type: String, trim: true },
    sourcePage: { type: String, trim: true },
    referrerUrl: { type: String, trim: true, default: null },
    leadStatus: { type: String, enum: ['new', 'contacted', 'qualified', 'enrolled', 'closed', 'counselling_booked', 'not_interested'], default: 'new' },
    leadStatusHistory: [{ status: { type: String, required: true }, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, changedAt: { type: Date, default: Date.now } }],
    leadNotes: [{ text: { type: String, required: true }, addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, addedAt: { type: Date, default: Date.now } }],
=======
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86

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

<<<<<<< HEAD
// Leads and assessment guests may share an email with an account. Only learner
// accounts need globally unique email addresses.
userSchema.index({ email: 1 }, { unique: true, name: 'email_learner_unique', partialFilterExpression: { accountRegistration: true } });

module.exports = mongoose.model('User', userSchema);
module.exports.leadSources = leadSources;
=======
module.exports = mongoose.model('User', userSchema);
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
