const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

test('account registration persists normalized learner data without email verification; lead capture stays separate', async (t) => {
  const originalResendKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_dummy_key';
  const mail = require('../services/emailService');
  const originals = {
    findOne: User.findOne,
    findOneAndUpdate: User.findOneAndUpdate,
    save: User.prototype.save,
    create: User.create,
    hash: bcrypt.hash,
    sendLearnerAccountCode: mail.sendLearnerAccountCode,
    sendNewStudentRegistrationAlert: mail.sendNewStudentRegistrationAlert,
    jwtSecret: process.env.JWT_SECRET,
    resendKey: originalResendKey,
  };
  t.after(() => {
    User.findOne = originals.findOne;
    User.findOneAndUpdate = originals.findOneAndUpdate;
    User.prototype.save = originals.save;
    User.create = originals.create;
    bcrypt.hash = originals.hash;
    mail.sendLearnerAccountCode = originals.sendLearnerAccountCode;
    mail.sendNewStudentRegistrationAlert = originals.sendNewStudentRegistrationAlert;
    if (originals.jwtSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originals.jwtSecret;
    if (originals.resendKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originals.resendKey;
  });

  process.env.JWT_SECRET = 'test-jwt-secret-for-learner-registration';
  const records = [];
  const emailedCodes = [];
  mail.sendLearnerAccountCode = async (email, code, purpose) => { emailedCodes.push({ email, code, purpose }); return { id: 'test-email' }; };
  mail.sendNewStudentRegistrationAlert = async () => ({ id: 'test-alert' });
  bcrypt.hash = async (plain) => `test-bcrypt-hash:${plain.length}`;
  User.prototype.save = async function saveMock() {
    if (!this.createdAt) this.createdAt = new Date();
    const index = records.findIndex((record) => String(record._id) === String(this._id));
    if (index < 0) records.push(this);
    else records[index] = this;
    return this;
  };
  const query = (record) => ({
    select: async () => record,
    then: (resolve, reject) => Promise.resolve(record).then(resolve, reject),
  });
  User.findOne = (filter) => query(records.find((record) => record.email === filter.email && (!filter.accountRegistration || record.accountRegistration === filter.accountRegistration)) || null);
  User.findOneAndUpdate = async (filter, update) => {
    const record = records.find((item) => String(item._id) === String(filter._id));
    if (!record) return null;
    Object.assign(record, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) record.set(key, undefined);
    return record;
  };
  User.create = async (input) => {
    const record = new User(input);
    record.createdAt = new Date();
    records.push(record);
    return record;
  };

  const auth = require('../controllers/authController');
  const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const signupRes = response();
  await auth.registerStudent({ body: {
    accountRegistration: true,
    name: 'Learner Example', email: '  LEARNER@example.test ', password: 'learner-secret',
    mobile: '+919876543210', course: 'Mathematics', curriculum: 'CBSE', grade: '8', school: 'Example School', country: 'India',
    parentName: 'Guardian Example', parentEmail: ' GUARDIAN@example.test ', parentMobile: '+919876543211',
    leadSource: 'course_enrollment', leadIntent: 'account signup', sourcePage: '/account/signup',
    registrationUrl: 'https://lurnex.test/account/signup', referrerUrl: 'https://lurnex.test/',
  } }, signupRes);

  assert.equal(signupRes.statusCode, 201);
  assert.ok(signupRes.body.token);
  assert.equal(signupRes.body.user.emailVerified, true);
  assert.equal(records.length, 1);
  const learner = records[0];
  const learnerId = String(learner._id);
  assert.equal(learner.email, 'learner@example.test');
  assert.equal(learner.parentEmail, 'guardian@example.test');
  assert.equal(learner.role, 'student');
  assert.equal(learner.accountRegistration, true);
  assert.equal(learner.emailVerified, true);
  assert.equal(learner.accountStatus, 'active');
  assert.ok(learner.createdAt instanceof Date);
  assert.ok(learner.password.startsWith('test-bcrypt-hash:'));
  assert.notEqual(learner.password, 'learner-secret');
  assert.equal(learner.verificationCodeHash, undefined);
  assert.deepEqual(emailedCodes, []);
  assert.equal(learner.leadSource, 'course_enrollment');
  assert.equal(learner.sourcePage, '/account/signup');

  assert.equal(records.length, 1);
  assert.equal(String(records[0]._id), learnerId);
  assert.equal(signupRes.body.user.id, learnerId);
  assert.equal(signupRes.body.user.password, undefined);
  assert.equal(signupRes.body.user.verificationCodeHash, undefined);

  const leadRes = response();
  await auth.registerStudent({ body: { name: 'Lead Example', email: 'lead@example.test', mobile: '+919876543212', course: 'Science', grade: '7', school: 'Example School' } }, leadRes);
  assert.equal(leadRes.statusCode, 201);
  const lead = records.find((record) => record.email === 'lead@example.test');
  assert.ok(lead);
  assert.equal(lead.accountRegistration, false);
  assert.equal(lead.isLead, true);
  assert.equal(lead.password, undefined);
});
