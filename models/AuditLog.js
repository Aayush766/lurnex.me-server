const mongoose = require('mongoose');
const auditSchema = new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, action: { type: String, required: true }, target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, details: { type: mongoose.Schema.Types.Mixed, default: {} }, ip: String, createdAt: { type: Date, default: Date.now, index: true } }, { versionKey: false });
auditSchema.index({ target: 1, createdAt: -1 });
module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditSchema);
