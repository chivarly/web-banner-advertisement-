const express = require('express');
const router = express.Router();

const Batch = require('../models/Batch');
const Participant = require('../models/Participant');
const Response = require('../models/Response');

const CONDITIONS = {
  a: { label: 'AC1', background: 'Analogous',     product: 'Donut',   bgColor: '#8BC34A', accentColor: '#CDDC39' },
  b: { label: 'AC2', background: 'Analogous',     product: 'Tumbler', bgColor: '#8BC34A', accentColor: '#CDDC39' },
  c: { label: 'AC3', background: 'Analogous',     product: 'Rolex',   bgColor: '#8BC34A', accentColor: '#CDDC39' },
  d: { label: 'CC1', background: 'Complementary', product: 'Donut',   bgColor: '#FDD835', accentColor: '#7B1FA2' },
  e: { label: 'CC2', background: 'Complementary', product: 'Tumbler', bgColor: '#FDD835', accentColor: '#7B1FA2' },
  f: { label: 'CC3', background: 'Complementary', product: 'Rolex',   bgColor: '#FDD835', accentColor: '#7B1FA2' }
};

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── GET /api/batch/:batchNumber ───────────────────────
router.get('/batch/:batchNumber', async (req, res) => {
  try {
    const batchNumber = parseInt(req.params.batchNumber);
    if (isNaN(batchNumber) || batchNumber < 1 || batchNumber > 6) {
      return res.status(400).json({ error: 'Invalid batch number. Must be 1–6.' });
    }
    const batch = await Batch.findOne({ batchNumber });
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });

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

// ── POST /api/session/start ───────────────────────────
// Body: { batchNumber, name?, email }
router.post('/session/start', async (req, res) => {
  try {
    const { batchNumber, name, email } = req.body;

    const num = parseInt(batchNumber);

    if (isNaN(num) || num < 1 || num > 6) {
      return res.status(400).json({ error: 'Invalid batch number.' });
    }

    if (!email || !isValidEmail(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const batch = await Batch.findOne({ batchNumber: num });
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });

    const sessionId = generateSessionId();

    // ✔ CREATE TEMP PARTICIPANT (safe placeholder)
    await Participant.create({
      sessionId,
      batchNumber: num,
      name: (name || '').trim(),
      email: email.trim().toLowerCase(),
      currentStep: 0,
      completed: false
    });

    return res.status(201).json({
      sessionId,
      batchNumber: num
    });

  } catch (err) {
    console.error('POST /session/start error:', err);
    res.status(500).json({ error: 'Server error creating session.' });
  }
});

// ── GET /api/session/:sessionId ───────────────────────
router.get('/session/:sessionId', async (req, res) => {
  try {
    const participant = await Participant.findOne({ sessionId: req.params.sessionId });
    if (!participant) return res.status(404).json({ error: 'Session not found.' });
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

// ── POST /api/response ────────────────────────────────
// Body: { sessionId, stepIndex, conditionCode, answers }
router.post('/response', async (req, res) => {
  try {
    const { sessionId, stepIndex, conditionCode, answers } = req.body;

    const participant = await Participant.findOne({ sessionId });
    if (!participant) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (participant.completed) {
      return res.status(400).json({ error: 'Experiment already completed.' });
    }

    const conditionMeta = CONDITIONS[conditionCode];
    if (!conditionMeta) {
      return res.status(400).json({ error: 'Invalid condition code.' });
    }

    const conditionLabel = conditionMeta.label;

    // validate answers
    const required = ['q1','q2','q3','q4','q5','q6','q7','q8','q9'];
    for (const q of required) {
      const val = parseInt(answers?.[q]);
      if (isNaN(val) || val < 1 || val > 5) {
        return res.status(400).json({ error: `Invalid answer for ${q}. Must be 1–5.` });
      }
    }

    // ⭐ SAVE EVERY CONDITION RESPONSE (THIS FIXES YOUR ISSUE)
    await Response.findOneAndUpdate(
      { sessionId, conditionCode },
      {
        sessionId,
        participantName: participant.name || '',
        participantEmail: participant.email || '',
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

    const nextStep = stepIndex + 1;
    const isComplete = nextStep >= 6;

    // only mark participant completed at the end
    await Participant.findOneAndUpdate(
      { sessionId },
      {
        currentStep: nextStep,
        completed: isComplete,
        ...(isComplete ? { completedAt: new Date() } : {})
      }
    );

    res.status(201).json({ success: true, nextStep, isComplete });

  } catch (err) {
    console.error('POST /response error:', err);
    res.status(500).json({ error: 'Server error saving response.' });
  }
});

module.exports = router;