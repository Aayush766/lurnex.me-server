const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    excerpt: { type: String, default: '', maxlength: 500 },
    // Kept as an HTML string so both the visual editor and source editor round-trip.
    content: { type: String, default: '' },
    sourceUrl: { type: String, required: true, unique: true, trim: true, maxlength: 500 },
    seoTitle: { type: String, default: '', maxlength: 70 },
    metaDescription: { type: String, default: '', maxlength: 320 },
    metaKeywords: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  },
  { timestamps: true }
);

pageSchema.index({ sourceUrl: 1 }, { unique: true });

module.exports = mongoose.model('Page', pageSchema);
