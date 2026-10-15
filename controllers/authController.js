const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const { addPasswordHistoryEntry } = require('../utils/passwordHistory');
const { sendNewStudentRegistrationAlert, sendLearnerAccountCode } = require('../services/emailService');
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const codeHash = (code) => crypto.createHash('sha256').update(code).digest('hex');
const codeMatches = (provided, expected) => { const a = Buffer.from(codeHash(provided)); const b = Buffer.from(expected || ''); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, emailVerified: !!u.emailVerified, accountStatus: u.accountStatus || 'active', avatarUrl: u.avatarUrl || u.profilePictureUrl || null, curriculum: u.curriculum || u.course || '', course: u.course || '', grade: u.grade || '', school: u.school || '', country: u.country || '', mobile: u.mobile || '', parentName: u.parentName || '', parentEmail: u.parentEmail || '', parentMobile: u.parentMobile || '' });
const issueCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const emailCode = async (email, code, purpose) => {
  if (!process.env.RESEND_API_KEY) throw new Error('Email delivery is not configured');
  const sent = await sendLearnerAccountCode(email, code, purpose);
  if (!sent) throw new Error('Email delivery failed');
};
exports.resendLearnerVerificationCode = async (user) => {
  const code = issueCode();
  user.verificationCodeHash = codeHash(code);
  user.verificationCodeExpiresAt = new Date(Date.now() + 10 * 60_000);
  user.verificationAttempts = 0;
  await user.save();
  await emailCode(user.email, code, 'verify');
};
const isUrl = (v) => { if (v == null || v === '') return true; try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } };
exports.registerStudent = async (req, res) => {
  const b = req.body || {}; const email = String(b.email || '').trim().toLowerCase();
  const parentEmailNormalized = String(b.parentEmail || '').trim().toLowerCase();
  const { name, mobile, course, curriculum, grade, school, country, parentName, parentEmail, parentMobile, leadSource, leadIntent, registrationUrl, sourcePage, referrerUrl } = b;
  if (leadSource != null && !User.leadSources.includes(leadSource)) return res.status(400).json({ message: 'Invalid leadSource.' });
  if (!isUrl(registrationUrl) || !isUrl(referrerUrl)) return res.status(400).json({ message: 'registrationUrl and referrerUrl must be valid HTTP or HTTPS URLs.' });
  if (sourcePage && (typeof sourcePage !== 'string' || !sourcePage.startsWith('/') || sourcePage.startsWith('//'))) return res.status(400).json({ message: 'sourcePage must be a page path beginning with /.' });
  const account = b.accountRegistration === true;
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !mobile || !course && !curriculum || !grade || !school || (account && (!b.password || b.password.length < 8 || !parentName || !/^\S+@\S+\.\S+$/.test(parentEmailNormalized) || !/^\+[1-9]\d{7,14}$/.test(String(parentMobile || '')) || !/^\+[1-9]\d{7,14}$/.test(mobile)))) return res.status(400).json({ message: 'Please check the required registration details.' });
  if (account) {
    const limits = { name:100, email:254, mobile:16, course:100, curriculum:100, grade:50, school:150, country:100, parentName:100, parentEmail:254, parentMobile:16 };
    const requiredText = ['name','email','mobile','grade','school','country','parentName','parentEmail','parentMobile'];
    if (requiredText.some((key) => typeof b[key] !== 'string' || !b[key].trim()) || !(String(course || '').trim() || String(curriculum || '').trim()) || Object.entries(limits).some(([key,max]) => b[key] !== undefined && (typeof b[key] !== 'string' || b[key].trim().length > max)) || typeof b.password !== 'string' || b.password.length > 128) return res.status(400).json({ message: 'Please check the required registration details.' });
  }
  try {
    // A previous lead capture is not a login account and may be upgraded by
    // creating a separate learner account. Keep duplicate lead behavior intact.
    const exists = await User.findOne(account
      ? { email, $or: [{ accountRegistration: true }, { role: { $in: ['admin', 'trainer'] } }, { role: 'student', isLead: { $ne: true }, password: { $exists: true } }] }
      : { email });
    if (exists) return res.status(409).json({ message: 'An account or lead with this email already exists.' });
    if (account) {
      const password = await bcrypt.hash(b.password, 12);
      const user = new User({ name, email, role: 'student', status: 'pending' });
      Object.assign(user, { name: String(name).trim(), email, password, accountRegistration: true, isLead: false, emailVerified: true, accountStatus: 'active', mobile: mobile.trim(), course: String(course || curriculum).trim(), curriculum: String(curriculum || course).trim(), grade: String(grade).trim(), school: String(school).trim(), country: String(country || '').trim(), parentName: String(parentName).trim(), parentEmail: String(parentEmail).trim().toLowerCase(), parentMobile: String(parentMobile).trim(), leadSource, leadIntent, registrationUrl, sourcePage, referrerUrl: referrerUrl || null, isTemporaryPassword: false });
      await user.save();
      return res.status(201).json({ token: generateToken(user._id), user: publicUser(user) });
    }
    // Lead captures remain non-login records; legacy registrations without a password are accepted.
    const lead = await User.create({ name, email, mobile, course: course || curriculum, curriculum: curriculum || course, grade, school, country: country || 'N/A', leadSource, leadIntent, registrationUrl, sourcePage, referrerUrl: referrerUrl || null, role: 'student', status: 'pending', accountRegistration: false, isLead: true, registeredFrom: 'Public Registration Form' });
    sendNewStudentRegistrationAlert({ name, email, mobile, course, grade, country, enrolledOn: lead.createdAt, registeredFrom: 'Public Registration Form' }).catch(() => {});
    return res.status(201).json({ message: 'Registration successful.', lead: { id: lead.id } });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' }); console.error('Registration failed:', { name: e.name, code: e.code || 'unknown' }); return res.status(500).json({ message: 'Could not complete registration.' }); }
};
exports.verifyEmail = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(); const code = String(req.body.code || '');
  try { const u = await User.findOne({ email, accountRegistration: true }).select('+verificationCodeHash +verificationCodeExpiresAt +verificationAttempts +password');
    if (!u || u.emailVerified || !u.verificationCodeHash || u.verificationCodeExpiresAt < new Date() || u.verificationAttempts >= 5) return res.status(400).json({ message: 'This code is invalid or expired. Request a new code.' });
    if (!codeMatches(code, u.verificationCodeHash)) { await User.updateOne({ _id:u._id, emailVerified:false, verificationCodeHash:u.verificationCodeHash, verificationAttempts: { $lt: 5 } }, { $inc: { verificationAttempts: 1 } }); return res.status(400).json({ message: 'This code is invalid or expired. Request a new code.' }); }
    const verified = await User.findOneAndUpdate({ _id:u._id, emailVerified:false, verificationCodeHash:u.verificationCodeHash, verificationCodeExpiresAt: { $gt:new Date() }, verificationAttempts: { $lt:5 } }, { $set:{ emailVerified:true, accountStatus:'active', verificationAttempts:0 }, $unset:{ verificationCodeHash:1, verificationCodeExpiresAt:1 } }, { new:true });
    if (!verified) return res.status(400).json({ message: 'This code is invalid or expired. Request a new code.' });
    return res.json({ token: generateToken(verified._id), user: publicUser(verified) });
  } catch (e) { return res.status(500).json({ message: 'Could not verify email.' }); }
};
exports.resendVerification = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(); const generic = { message: 'If an eligible account exists, a code will be sent shortly.' };
  try { const u = await User.findOne({ email, accountRegistration: true, emailVerified: false }).select('+password'); if (u) { const code = issueCode(); u.verificationCodeHash = codeHash(code); u.verificationCodeExpiresAt = new Date(Date.now() + 600000); u.verificationAttempts = 0; await u.save(); await emailCode(email, code, 'verify'); } } catch(e) { console.error('Resend verification failed:', e.message); } return res.json(generic);
};
exports.loginUser = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  try { const u = await User.findOne(req.body.role ? { email, role: req.body.role } : { email, accountRegistration: true }).select('+password'); if (!u || !u.password || !(await bcrypt.compare(String(req.body.password || ''), u.password))) return res.status(401).json({ message: 'Email or password is incorrect.' }); if (u.accountRegistration && u.accountStatus === 'suspended') return res.status(403).json({ message: 'This account is currently unavailable. Please contact support.' }); if (u.accountRegistration) return res.json({ token: generateToken(u._id), user: publicUser(u) }); return res.json({ _id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, isTemporaryPassword: u.isTemporaryPassword, token: generateToken(u._id) }); }
  catch(e) { return res.status(500).json({ message: 'Could not sign in.' }); }
};
exports.requestPasswordReset = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  try { const u = await User.findOne({ email, accountRegistration: true }).select('+password'); if (u) { const code = issueCode(); u.resetCodeHash = codeHash(code); u.resetCodeExpiresAt = new Date(Date.now()+600000); u.resetAttempts = 0; await u.save(); await emailCode(email, code, 'reset'); } } catch(e) { console.error('Password reset request failed:', e.message); } return res.json({ message: 'If an eligible account exists, password reset instructions will be sent.' });
};
exports.resetPasswordWithCode = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(); const code = String(req.body.code || ''); const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  try { const u = await User.findOne({ email, accountRegistration: true }).select('+resetCodeHash +resetCodeExpiresAt +resetAttempts +password'); if (!u || !u.resetCodeHash || u.resetCodeExpiresAt < new Date() || u.resetAttempts >= 5) return res.status(400).json({ message: 'This code is invalid or expired.' }); if (!codeMatches(code, u.resetCodeHash)) { await User.updateOne({ _id:u._id, resetCodeHash:u.resetCodeHash, resetAttempts: { $lt:5 } }, { $inc: { resetAttempts:1 } }); return res.status(400).json({ message: 'This code is invalid or expired.' }); } const hashed = await bcrypt.hash(password,12); const updated = await User.findOneAndUpdate({ _id:u._id, resetCodeHash:u.resetCodeHash, resetCodeExpiresAt: { $gt:new Date() }, resetAttempts: { $lt:5 } }, { $set:{password:hashed,resetAttempts:0}, $unset:{resetCodeHash:1,resetCodeExpiresAt:1}, $push:{passwordHistory:{passwordHash:hashed,changedBy:u._id,isTemporary:false,changedAt:new Date()}} }, {new:true}); if(!updated)return res.status(400).json({message:'This code is invalid or expired.'}); return res.json({ message: 'Password updated. You can now sign in.' }); } catch(e) { return res.status(500).json({ message: 'Could not reset password.' }); }
};
exports.resetPassword = async (req, res) => { const u = await User.findById(req.user.id).select('+password'); if (!u) return res.status(404).json({ message: 'User not found.' }); const hashed = await bcrypt.hash(String(req.body.newPassword || ''), 12); u.password = hashed; u.isTemporaryPassword = false; await addPasswordHistoryEntry(u, hashed, { changedBy:u._id, isTemporary:false }); await u.save(); return res.json({ token: generateToken(u._id), user: publicUser(u) }); };
