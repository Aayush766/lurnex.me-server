const mongoose = require('mongoose');

async function connectDatabase() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  const options = {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  };
  if (process.env.MONGO_DB_NAME) options.dbName = process.env.MONGO_DB_NAME;
  return mongoose.connect(process.env.MONGO_URI, options);
}

module.exports = connectDatabase;
