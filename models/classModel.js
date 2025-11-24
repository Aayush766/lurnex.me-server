// models/classModel.js

const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    title: { type: String, required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    zoomLink: { type: String, required: true },
    recordingUrl: { type: String, default: '' },
    
    // ✨ NEW: Class Assignment Fields
    batchId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Batch' 
    },
    studentIds: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    

status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    cancellationReason: {
        type: String,
        default: null
    },
    cancelledBy: {
        type: String,
        enum: ['student', 'trainer', 'admin', null], // Tracks who initiated the cancellation
        default: null
    }
    
}, { timestamps: true });


module.exports = mongoose.model('Class', classSchema);