const User = require('../models/userModel');

const leadFields = '_id name email mobile course grade school country parentName satParentName satFocus satPreferredSession satTargetDate satAttribution leadType leadSource leadIntent registrationUrl sourcePage referrerUrl leadStatus leadNotes leadStatusHistory createdAt updatedAt registeredFrom isLead linkedAccountId';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const leadFilter = { role: 'student', accountRegistration: { $ne: true }, $and: [{ $or: [{ isLead: true }, { leadSource: { $exists: true, $ne: null } }, { leadIntent: { $exists: true, $ne: null } }, { registeredFrom: 'Public Registration Form' }, { password: { $exists: false } }, { isTemporaryPassword: true, registeredFrom: { $exists: false } }] }] };

exports.listLeads = async (req, res) => {
  try {
    const { source, course, grade, search, from, to, satMasterclass, preferredSession, focus, status } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const filter = { ...leadFilter };
    if (satMasterclass === 'true') filter.leadType = 'sat_masterclass';
    if (source) filter.leadSource = source;
    if (course) filter.course = course;
    if (grade) filter.grade = grade;
    if (preferredSession) filter.satPreferredSession = preferredSession;
    if (focus) filter.satFocus = focus;
    if (status) filter.leadStatus = status;
    if (search) {
      const pattern = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }, { mobile: pattern }];
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) { const end = new Date(to); end.setDate(end.getDate() + 1); filter.createdAt.$lt = end; }
    }

    const [leads, total, sourceCounts, courseCounts] = await Promise.all([
      User.find(filter).select(leadFields).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
      User.aggregate([{ $match: leadFilter }, { $group: { _id: { $ifNull: ['$leadSource', '$registeredFrom'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      User.aggregate([{ $match: leadFilter }, { $group: { _id: { $ifNull: ['$course', 'Unknown'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);
    res.json({ leads, page, limit, total, pages: Math.ceil(total / limit), counts: { bySource: sourceCounts, byCourse: courseCounts } });
  } catch (error) {
    console.error('List leads error:', error);
    res.status(500).json({ message: 'Could not load leads.' });
  }
};

exports.getLead = async (req, res) => {
  try {
    const lead = await User.findOne({ ...leadFilter, _id: req.params.id }).select(leadFields).lean();
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: 'Invalid lead ID.' });
  }
};

exports.updateLead = async (req, res) => {
  const allowedStatuses = ['new', 'contacted', 'qualified', 'enrolled', 'closed', 'counselling_booked', 'not_interested'];
  const { status, note } = req.body;
  if (status !== undefined && !allowedStatuses.includes(status)) return res.status(400).json({ message: 'Invalid lead status.' });
  if (note !== undefined && (typeof note !== 'string' || !note.trim())) return res.status(400).json({ message: 'Note cannot be empty.' });
  try {
    const lead = await User.findOne({ ...leadFilter, _id: req.params.id });
    if (!lead) return res.status(404).json({ message: 'Lead not found.' });
    if (status && status !== lead.leadStatus) {
      lead.leadStatus = status;
      lead.leadStatusHistory.push({ status, changedBy: req.user._id, changedAt: new Date() });
    }
    if (note !== undefined) lead.leadNotes.push({ text: note.trim(), addedBy: req.user._id });
    await lead.save();
    res.json({ message: 'Lead updated successfully.', lead: await User.findById(lead._id).select(leadFields).lean() });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ message: 'Could not update lead.' });
  }
};
