'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fileforge');
  console.log('✅ Connected to MongoDB');

  // Create indexes
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const conversions = db.collection('conversions');

  await users.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  await conversions.createIndex({ user: 1, createdAt: -1 }).catch(() => {});
  await conversions.createIndex({ downloadToken: 1 }).catch(() => {});
  await conversions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});

  console.log('✅ Indexes created');
  await mongoose.disconnect();
  console.log('✅ Migration complete');
}

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
