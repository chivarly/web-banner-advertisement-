const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchNumber: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 6
  },
  // Sequence of condition codes: a=AC1, b=AC2, c=AC3, d=CC1, e=CC2, f=CC3
  sequence: {
    type: [String],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length === 6 && arr.every(v => ['a','b','c','d','e','f'].includes(v));
      },
      message: 'Sequence must contain exactly 6 valid condition codes'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);