const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true
  },
  // Participant info (copied from session for easy querying)
  participantName: {
    type: String,
    default: ''
  },
  participantEmail: {
    type: String,
    default: ''
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
  },
  stepIndex: {
    type: Number,
    required: true
  },
  answers: {
    q1: { type: Number, min: 1, max: 5, required: true },
    q2: { type: Number, min: 1, max: 5, required: true },
    q3: { type: Number, min: 1, max: 5, required: true },
    q4: { type: Number, min: 1, max: 5, required: true },
    q5: { type: Number, min: 1, max: 5, required: true },
    q6: { type: Number, min: 1, max: 5, required: true },
    q7: { type: Number, min: 1, max: 5, required: true },
    q8: { type: Number, min: 1, max: 5, required: true },
    q9: { type: Number, min: 1, max: 5, required: true }
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

responseSchema.index({ sessionId: 1, conditionCode: 1 }, { unique: true });

module.exports = mongoose.model('Response', responseSchema);