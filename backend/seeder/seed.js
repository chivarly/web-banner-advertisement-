/**
 * Run this once to seed the batches collection in MongoDB.
 * Usage: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Batch = require('../models/Batch');

const BATCHES = [
  { batchNumber: 1, sequence: ['d', 'e', 'c', 'f', 'b', 'a'] },
  { batchNumber: 2, sequence: ['e', 'f', 'd', 'a', 'c', 'b'] },
  { batchNumber: 3, sequence: ['f', 'a', 'e', 'b', 'd', 'c'] },
  { batchNumber: 4, sequence: ['c', 'd', 'b', 'e', 'a', 'f'] },
  { batchNumber: 5, sequence: ['a', 'b', 'f', 'c', 'e', 'd'] },
  { batchNumber: 6, sequence: ['b', 'c', 'a', 'd', 'f', 'e'] }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    await Batch.deleteMany({});
    console.log('Cleared existing batches');

    await Batch.insertMany(BATCHES);
    console.log('✅ Seeded 6 batches successfully:');
    BATCHES.forEach(b => {
      console.log(`  Batch ${b.batchNumber}: [${b.sequence.join(', ')}]`);
    });

  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seed();