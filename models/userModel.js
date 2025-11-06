// models/userModel.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'trainer', 'admin'], default: 'student' },
    status: { type: String, enum: ['paid', 'pending'], default: 'pending' }, 
    enrolledClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    
    // Registration/Contact Info
    mobile: { type: String },
    course: { type: String },
    grade: { type: String },
    school: { type: String },
    
    // ✨ STUDENT HOUR TRACKING FIELDS
    totalPaidHours: { 
        type: Number, 
        default: 0 
    },
    hoursHistory: { 
        type: [
            {
                hours: { type: Number, required: true },
                date: { type: Date, required: true }, // Store dates as Date type
                notes: { type: String }
            }
        ],
        default: [] // Ensures this array is always initialized
    },
    
    // ✨ NEW FIELDS FOR BATCH/ASSIGNMENT TRACKING:
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch', // Assumes a Batch model exists
        default: null,
        index: true
    },
    isOneOnOne: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
// End of userModel.js