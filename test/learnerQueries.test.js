const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLearnerListOptions } = require('../services/learnerQueries');

test('default learner listing includes pending, unverified accounts and excludes leads', () => {
  const options = buildLearnerListOptions({});
  assert.deepEqual(options.filter, { role: 'student', accountRegistration: true });
  assert.equal(options.page, 1);
  assert.equal(options.limit, 20);
  assert.equal(options.skip, 0);
  assert.equal(options.filter.emailVerified, undefined);
});

test('learner listing combines account status, verification, search, profile and date filters', () => {
  const options = buildLearnerListOptions({
    page: '3', limit: '25', search: 'ada+test@example.com', verified: 'false', accountStatus: 'pending',
    curriculum: 'CBSE', grade: '8', from: '2026-01-02', to: '2026-01-04', sortBy: 'email', order: 'asc',
  });
  assert.equal(options.filter.role, 'student');
  assert.equal(options.filter.accountRegistration, true);
  assert.equal(options.filter.emailVerified, false);
  assert.equal(options.filter.accountStatus, 'pending');
  assert.equal(options.filter.curriculum, 'CBSE');
  assert.equal(options.filter.grade, '8');
  assert.equal(options.filter.$or[0].name.$regex, 'ada\\+test@example\\.com');
  assert.equal(options.filter.createdAt.$gte.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(options.filter.createdAt.$lte.toISOString(), '2026-01-04T23:59:59.999Z');
  assert.equal(options.page, 3);
  assert.equal(options.limit, 25);
  assert.equal(options.skip, 50);
  assert.deepEqual(options.sort, { email: 1, _id: -1 });
});

test('learner query rejects invalid status and date ranges', () => {
  assert.equal(buildLearnerListOptions({ accountStatus: 'deleted' }).error, 'Invalid account status filter.');
  assert.equal(buildLearnerListOptions({ from: 'not-a-date' }).error, 'Invalid registration date filter.');
  assert.equal(buildLearnerListOptions({ from: '2026-02-02', to: '2026-02-01' }).error, 'Registration start date must be before the end date.');
});
