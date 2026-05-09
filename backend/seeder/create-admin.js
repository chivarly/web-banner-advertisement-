/**
 * Creates the default admin account.
 * Run once: node create-admin.js
 *
 * Change the credentials below before running in production.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const DEFAULT_ADMIN = {
  username: 'admin',
  password: '12345678',   // ← Change this before running!
  displayName: 'Researcher Admin'
};

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    const existing = await Admin.findOne({ username: DEFAULT_ADMIN.username });
    if (existing) {
      console.log(`⚠️  Admin "${DEFAULT_ADMIN.username}" already exists. Skipping.`);
      console.log('   To reset, delete the admin document from MongoDB and re-run.');
    } else {
      await Admin.create(DEFAULT_ADMIN);
      console.log('✅ Admin account created!');
      console.log(`   Username : ${DEFAULT_ADMIN.username}`);
      console.log(`   Password : ${DEFAULT_ADMIN.password}`);
      console.log('\n   ⚠️  Change the password after first login (or edit this file before running).');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();