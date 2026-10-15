const User = require('../models/userModel');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const Class = require('../models/classModel');
const Doubt = require('../models/DoubtModel');
const cloudinary = require('../config/cloudinary');

const profile = (u) => ({
  id: String(u._id), name: u.name, email: u.email, emailVerified: !!u.emailVerified,
  avatarUrl: u.avatarUrl || u.profilePictureUrl || null, curriculum: u.curriculum || '',
  course: u.course || '', grade: u.grade || '', school: u.school || '', country: u.country || '',
  mobile: u.mobile || '', parentName: u.parentName || '', parentEmail: u.parentEmail || '', parentMobile: u.parentMobile || '',
});
const learnerOnly = (req, res, next) => {
  if (req.user?.role !== 'student' || req.user?.accountRegistration !== true) return res.status(403).json({ message: 'Learner account access required.' });
  next();
};
exports.learnerOnly = learnerOnly;
exports.getProfile = async (req, res) => {
  const u = await User.findById(req.user._id);
  if (!u || !u.accountRegistration) return res.status(404).json({ message: 'Learner account not found.' });
  return res.json(profile(u));
};
exports.uploadAvatar = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a JPEG, PNG, or WebP image.' });
  const b = req.file.buffer;
  const signature = b.subarray(0, 12);
  const type = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff ? 'jpg'
    : signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
      : signature.toString('ascii', 0, 4) === 'RIFF' && signature.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  if (!type) return res.status(400).json({ message: 'Only JPEG, PNG, or WebP images are allowed.' });
  if (!process.env.CLOUDINARY_NAME || !process.env.CLOUDINARY_KEY || !process.env.CLOUDINARY_SECRET) return res.status(503).json({ message: 'Avatar storage is not configured.' });
  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'lurnex-avatars', resource_type: 'image', allowed_formats: ['jpg','png','webp'] }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(b);
    });
    const user = await User.findOneAndUpdate({ _id: req.user._id, accountRegistration: true }, { $set: { avatarUrl: result.secure_url } }, { new: true });
    if (!user) return res.status(404).json({ message: 'Learner account not found.' });
    return res.json({ avatarUrl: user.avatarUrl });
  } catch (error) { console.error('Avatar upload failed:', error.message); return res.status(500).json({ message: 'Could not upload avatar.' }); }
};
exports.dashboard = async (req, res) => {
  try {
    const learnerId = req.user._id;
    const [attempts, classes, questions] = await Promise.all([
      AssessmentAttempt.find({ student: learnerId }).select('status percentage startedAt submittedAt assessment').populate('assessment', 'title').sort({ createdAt: -1 }).limit(20).lean(),
      Class.find({ $or: [{ studentIds: learnerId }, ...(req.user.batchId ? [{ batchId: req.user.batchId }] : [])] }).select('title startTime createdAt status recordingUrl').sort({ startTime: -1 }).limit(20).lean(),
      Doubt.find({ student: learnerId }).select('question createdAt status').sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    const activity = [
      ...attempts.map(a => ({ id: String(a._id), type: 'assessment', title: a.assessment?.title || 'Assessment', createdAt: a.submittedAt || a.startedAt, href: '/assessments' })),
      ...classes.map(c => ({ id: String(c._id), type: 'class', title: c.title || 'Class', createdAt: c.startTime || c.createdAt, ...(c.recordingUrl ? { href: c.recordingUrl } : {}) })),
    ].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 20);
    const completed = attempts.filter(a => a.status === 'submitted');
    return res.json({ profile: profile(req.user), stats: { assessments: attempts.length, completedAssessments: completed.length, averageScore: completed.length ? Math.round(completed.reduce((s,a) => s + (a.percentage || 0), 0) / completed.length) : 0, classes: classes.length, forumQuestions: questions.length }, activity, downloads: [], forumQuestions: questions.map(q => ({ id: String(q._id), title: q.question, createdAt: q.createdAt, href: '/forum' })) });
  } catch (error) { console.error('Learner dashboard error:', error.message); return res.status(500).json({ message: 'Could not load learner activity.' }); }
};
