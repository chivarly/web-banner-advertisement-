const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('crypto').webcrypto
  ? (() => { try { return require('crypto'); } catch(e) { return null; } })()
  : null;

const Batch = require('../models/Batch');
const Participant = require('../models/Participant');
const Response = require('../models/Response');

// Condition code → label/metadata map
const CONDITIONS = {
  a: { label: 'AC1', background: 'analogous',     product: 'donut',  bgColor: '#8BC34A', accentColor: '#CDDC39' },
  b: { label: 'AC2', background: 'analogous',     product: 'tumbler',bgColor: '#8BC34A', accentColor: '#CDDC39' },
  c: { label: 'AC3', background: 'analogous',     product: 'rolex',  bgColor: '#8BC34A', accentColor: '#CDDC39' },
  d: { label: 'CC1', background: 'complementary', product: 'donut',  bgColor: '#FDD835', accentColor: '#7B1FA2' },
  e: { label: 'CC2', background: 'complementary', product: 'tumbler',bgColor: '#FDD835', accentColor: '#7B1FA2' },
  f: { label: 'CC3', background: 'complementary', product: 'rolex',  bgColor: '#FDD835', accentColor: '#7B1FA2' }
};

// Simple session ID generator (no uuid package dependency)
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

// ─────────────────────────────────────────
// GET /api/batch/:batchNumber
// Returns batch sequence + condition metadata
// ─────────────────────────────────────────
router.get('/batch/:batchNumber', async (req, res) => {
  try {
    const batchNumber = parseInt(req.params.batchNumber);
    if (isNaN(batchNumber) || batchNumber < 1 || batchNumber > 6) {
      return res.status(400).json({ error: 'Invalid batch number. Must be 1–6.' });
    }

    const batch = await Batch.findOne({ batchNumber });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found.' });
    }

    const sequence = batch.sequence.map((code, index) => ({
      stepIndex: index,
      code,
      ...CONDITIONS[code]
    }));

    res.json({ batchNumber, sequence });
  } catch (err) {
    console.error('GET /batch error:', err);
    res.status(500).json({ error: 'Server error fetching batch.' });
  }
});

// ─────────────────────────────────────────
// POST /api/session/start
// Creates a new participant session
// Body: { batchNumber }
// ─────────────────────────────────────────
router.post('/session/start', async (req, res) => {
  try {
    const { batchNumber } = req.body;
    const num = parseInt(batchNumber);

    if (isNaN(num) || num < 1 || num > 6) {
      return res.status(400).json({ error: 'Invalid batch number.' });
    }

    const batch = await Batch.findOne({ batchNumber: num });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found.' });
    }

    const sessionId = generateSessionId();
    const participant = new Participant({ sessionId, batchNumber: num, currentStep: 0 });
    await participant.save();

    res.status(201).json({ sessionId, batchNumber: num });
  } catch (err) {
    console.error('POST /session/start error:', err);
    res.status(500).json({ error: 'Server error creating session.' });
  }
});

// ─────────────────────────────────────────
// GET /api/session/:sessionId
// Returns session progress
// ─────────────────────────────────────────
router.get('/session/:sessionId', async (req, res) => {
  try {
    const participant = await Participant.findOne({ sessionId: req.params.sessionId });
    if (!participant) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    res.json({
      sessionId: participant.sessionId,
      batchNumber: participant.batchNumber,
      currentStep: participant.currentStep,
      completed: participant.completed
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching session.' });
  }
});

// ─────────────────────────────────────────
// POST /api/response
// Saves a participant's survey response for one condition
// Body: { sessionId, stepIndex, conditionCode, answers: { q1..q9 } }
// ─────────────────────────────────────────
router.post('/response', async (req, res) => {
  try {
    const { sessionId, stepIndex, conditionCode, answers } = req.body;

    // Validate session
    const participant = await Participant.findOne({ sessionId });
    if (!participant) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (participant.completed) {
      return res.status(400).json({ error: 'Experiment already completed.' });
    }

    // Validate condition code
    if (!CONDITIONS[conditionCode]) {
      return res.status(400).json({ error: 'Invalid condition code.' });
    }

    // Validate answers (all 9 questions, values 1–5)
    const required = ['q1','q2','q3','q4','q5','q6','q7','q8','q9'];
    for (const q of required) {
      const val = parseInt(answers?.[q]);
      if (isNaN(val) || val < 1 || val > 5) {
        return res.status(400).json({ error: `Invalid answer for ${q}. Must be 1–5.` });
      }
    }

    const conditionLabel = CONDITIONS[conditionCode].label;

    // Save response (upsert in case of resubmit)
    await Response.findOneAndUpdate(
      { sessionId, conditionCode },
      {
        sessionId,
        batchNumber: participant.batchNumber,
        conditionCode,
        conditionLabel,
        stepIndex,
        answers: {
          q1: parseInt(answers.q1),
          q2: parseInt(answers.q2),
          q3: parseInt(answers.q3),
          q4: parseInt(answers.q4),
          q5: parseInt(answers.q5),
          q6: parseInt(answers.q6),
          q7: parseInt(answers.q7),
          q8: parseInt(answers.q8),
          q9: parseInt(answers.q9)
        },
        submittedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // Advance participant step
    const nextStep = stepIndex + 1;
    const isComplete = nextStep >= 6;

    await Participant.findOneAndUpdate(
      { sessionId },
      {
        currentStep: nextStep,
        completed: isComplete,
        ...(isComplete ? { completedAt: new Date() } : {})
      }
    );

    res.status(201).json({
      success: true,
      nextStep,
      isComplete
    });
  } catch (err) {
    console.error('POST /response error:', err);
    res.status(500).json({ error: 'Server error saving response.' });
  }
});

module.exports = router;