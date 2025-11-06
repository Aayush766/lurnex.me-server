// models/batchModel.js

const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
    },
    timing: { 
        type: String, 
        required: true, 
        // Example: "Mon, Wed, Fri 7:00 PM - 8:30 PM"
    },
    course: {
        type: String,
        required: true,
        default: 'General'
    },
    // The trainer responsible for this batch
    trainer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model (role: 'trainer')
        required: true
    },
    // Array of class IDs associated with this batch
    classes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);