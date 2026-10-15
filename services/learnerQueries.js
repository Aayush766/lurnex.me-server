const SORT_FIELDS = new Set(['name', 'email', 'mobile', 'curriculum', 'grade', 'createdAt', 'emailVerified', 'accountStatus']);
const ACCOUNT_STATUSES = new Set(['pending', 'active', 'suspended']);

function buildLearnerListOptions(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const filter = { role: 'student', accountRegistration: true };
  const search = String(query.search || '').trim().slice(0, 100);
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }];
  }
  if (query.verified === 'true') filter.emailVerified = true;
  else if (query.verified === 'false') filter.emailVerified = false;
  if (query.accountStatus) {
    if (!ACCOUNT_STATUSES.has(String(query.accountStatus))) return { error: 'Invalid account status filter.' };
    filter.accountStatus = String(query.accountStatus);
  }
  if (query.curriculum) filter.curriculum = String(query.curriculum).slice(0, 100);
  if (query.grade) filter.grade = String(query.grade).slice(0, 50);

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return { error: 'Invalid registration date filter.' };
  if (to) to.setUTCHours(23, 59, 59, 999);
  if (from && to && from > to) return { error: 'Registration start date must be before the end date.' };
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };

  const sortBy = SORT_FIELDS.has(query.sortBy) ? query.sortBy : 'createdAt';
  const sort = { [sortBy]: query.order === 'asc' ? 1 : -1, _id: -1 };
  return { filter, page, limit, sort, skip: (page - 1) * limit };
}

module.exports = { buildLearnerListOptions };
