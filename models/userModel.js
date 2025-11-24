// models/userModel.js
const mongoose = require('mongoose');

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

        // ✨ STUDENT HOUR TRACKING FIELDS
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

        // ✨ NEW FIELDS FOR BATCH/ASSIGNMENT TRACKING (mainly for students/trainers)
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

        // For trainers:
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
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
