const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true
  },
  batchNumber: {
    type: Number,
    required: true
  },
  conditionCode: {
    type: String,
    required: true,
    enum: ['a', 'b', 'c', 'd', 'e', 'f']
  },
  conditionLabel: {
    type: String,
    required: true
    // e.g. "AC1", "CC2"
  },
  stepIndex: {
    type: Number,
    required: true  // 0-5, position in the batch sequence
  },
  // Likert scale answers (1–5) for each of the 9 statements
  answers: {
    q1: { type: Number, min: 1, max: 5, required: true }, // The colors used in the advertisement appear trustworthy.
    q2: { type: Number, min: 1, max: 5, required: true }, // I would like to buy this product for myself.
    q3: { type: Number, min: 1, max: 5, required: true }, // I perceive this advertisement as honest.
    q4: { type: Number, min: 1, max: 5, required: true }, // The overall appearance of the advertisement is appealing.
    q5: { type: Number, min: 1, max: 5, required: true }, // I feel that this advertisement is trustworthy.
    q6: { type: Number, min: 1, max: 5, required: true }, // The colors used in this advertisement are likable.
    q7: { type: Number, min: 1, max: 5, required: true }, // The colors used in this advertisement increase my desire to buy the product.
    q8: { type: Number, min: 1, max: 5, required: true }, // I like this advertisement.
    q9: { type: Number, min: 1, max: 5, required: true }  // The likelihood of me purchasing this product is high.
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index to prevent duplicate submissions
responseSchema.index({ sessionId: 1, conditionCode: 1 }, { unique: true });

module.exports = mongoose.model('Response', responseSchema);