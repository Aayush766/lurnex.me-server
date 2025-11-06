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
    
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);