const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  batchNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  completed: {
    type: Boolean,
    default: false
  },
  currentStep: {
    type: Number,
    default: 0  // 0-5 for each of the 6 conditions
  }
}, { timestamps: true });

module.exports = mongoose.model('Participant', participantSchema);