const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'trainer', 'admin'], default: 'student' },
    status: { type: String, enum: ['paid', 'pending'], default: 'pending' }, 
    enrolledClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    // ✨ NEW FIELDS TO STORE REGISTRATION DATA
    mobile: { type: String },
    course: { type: String },
    grade: { type: String },
    school: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);