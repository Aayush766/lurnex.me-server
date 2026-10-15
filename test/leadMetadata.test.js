const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/userModel');

test('accepts a supported leadSource', async () => {
  const user = new User({
    name: 'Test Student', email: 'valid@example.test', password: 'hash', leadSource: 'assessment_enrollment',
  });
  await assert.doesNotReject(user.validate());
});

test('rejects an unsupported leadSource', async () => {
  const user = new User({
    name: 'Test Student', email: 'invalid@example.test', password: 'hash', leadSource: 'unknown_source',
  });
  await assert.rejects(user.validate(), (error) => error.errors.leadSource?.kind === 'enum');
});

test('retains registrationUrl and sourcePage on the registration record', async () => {
  const registrationUrl = 'https://lurnex.me/register?campaign=spring';
  const sourcePage = '/register';
  const user = new User({
    name: 'Test Student', email: 'metadata@example.test', password: 'hash',
    registrationUrl, sourcePage, referrerUrl: 'https://search.example.test/results',
  });
  await user.validate();
  assert.equal(user.registrationUrl, registrationUrl);
  assert.equal(user.sourcePage, sourcePage);
});
