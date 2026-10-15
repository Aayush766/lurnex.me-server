require('dotenv').config();
const mongoose = require('mongoose');
const connectDatabase = require('../config/connectDatabase');

async function migrate() {
  await connectDatabase();
  const collection = mongoose.connection.collection('users');
  const indexes = await collection.indexes();
  const accounts = await collection.find({ accountRegistration: true, email: { $type: 'string' } }, { projection: { email: 1 } }).toArray();
  const normalizedOwners = new Map();
  for (const account of accounts) {
    const normalized = account.email.trim().toLowerCase();
    const existing = normalizedOwners.get(normalized);
    if (existing && String(existing) !== String(account._id)) throw new Error('Two learner accounts share the same normalized email. Resolve the duplicate account records, then rerun this migration.');
    normalizedOwners.set(normalized, account._id);
  }

  // Remove old global unique email indexes before normalizing accounts; leads
  // may legitimately share an email with a separately registered learner.
  const globalEmailIndexes = indexes.filter((index) => index.unique && index.key?.email === 1 && !index.partialFilterExpression);
  for (const index of globalEmailIndexes) await collection.dropIndex(index.name);
  for (const account of accounts) {
    const email = account.email.trim().toLowerCase();
    if (email !== account.email) await collection.updateOne({ _id: account._id }, { $set: { email } });
  }
  await collection.createIndex({ email: 1 }, {
    unique: true,
    name: 'email_learner_unique',
    partialFilterExpression: { accountRegistration: true },
  });
  console.log('Learner email index is ready.');
}

migrate().catch((error) => { console.error('Learner email index migration failed:', error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
