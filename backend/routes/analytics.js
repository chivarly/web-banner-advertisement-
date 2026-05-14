const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Response = require('../models/Response');
const Participant = require('../models/Participant');

// Condition metadata
const CONDITIONS = {
  a: { label: 'AC1', background: 'Analogous',     product: 'Donut',   colorScheme: 'Yellow-Green' },
  b: { label: 'AC2', background: 'Analogous',     product: 'Tumbler', colorScheme: 'Yellow-Green' },
  c: { label: 'AC3', background: 'Analogous',     product: 'Rolex',   colorScheme: 'Yellow-Green' },
  d: { label: 'CC1', background: 'Complementary', product: 'Donut',   colorScheme: 'Yellow-Purple' },
  e: { label: 'CC2', background: 'Complementary', product: 'Tumbler', colorScheme: 'Yellow-Purple' },
  f: { label: 'CC3', background: 'Complementary', product: 'Rolex',   colorScheme: 'Yellow-Purple' }
};

const QUESTION_LABELS = {
  q1: 'Colors appear trustworthy',
  q2: 'Want to buy the product',
  q3: 'Advertisement perceived as honest',
  q4: 'Overall appearance is appealing',
  q5: 'Advertisement feels trustworthy',
  q6: 'Colors are likable',
  q7: 'Colors increase desire to buy',
  q8: 'Like this advertisement',
  q9: 'Likelihood of purchasing is high'
};

// Thematic groupings
const DIMENSIONS = {
  trustworthiness: { label: 'Trustworthiness', questions: ['q1', 'q3', 'q5'], color: '#6366f1' },
  purchaseIntent:  { label: 'Purchase Intent',  questions: ['q2', 'q7', 'q9'], color: '#f59e0b' },
  aesthetics:      { label: 'Aesthetics',        questions: ['q4', 'q6', 'q8'], color: '#10b981' }
};

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round2(n) { return Math.round(n * 100) / 100; }

// Apply auth to all analytics routes
router.use(authMiddleware);

// ─────────────────────────────────────────
// GET /api/analytics/overview
// Summary stats: participant counts, completion rate, response counts
// ─────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const completedParticipants = await Participant.countDocuments({ completed: true });
    const inProgressParticipants = await Participant.countDocuments({ completed: false });
    const totalResponses = await Response.countDocuments();

    // Since you only store completed participants now
    const totalParticipants = completedParticipants;

    const completionRate = 100; // no incomplete users stored anymore

    // Calculate overall average
    const allResponses = await Response.find({}, 'answers');
    let allScores = [];

    allResponses.forEach(r => {
      Object.values(r.answers.toObject ? r.answers.toObject() : r.answers)
        .forEach(v => { if (typeof v === 'number') allScores.push(v); });
    });

    const overallAvg = allScores.length
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100
      : 0;

    res.json({
      totalParticipants,
      completedParticipants,
      inProgressParticipants: 0,
      completionRate,
      totalResponses,
      overallAvg
    });

  } catch (err) {
    console.error('Overview error:', err);
    res.status(500).json({ error: 'Error fetching overview.' });
  }
});

// ─────────────────────────────────────────
// GET /api/analytics/by-condition
// Per-condition mean scores for each question + dimension averages
// ─────────────────────────────────────────
router.get('/by-condition', async (req, res) => {
  try {
    const responses = await Response.find({});

    // Group by conditionCode
    const grouped = {};
    Object.keys(CONDITIONS).forEach(code => { grouped[code] = []; });
    responses.forEach(r => { if (grouped[r.conditionCode]) grouped[r.conditionCode].push(r); });

    const result = Object.entries(CONDITIONS).map(([code, meta]) => {
      const rList = grouped[code];
      const n = rList.length;

      // Per-question means
      const questionMeans = {};
      Object.keys(QUESTION_LABELS).forEach(q => {
        const scores = rList.map(r => r.answers[q]).filter(v => typeof v === 'number');
        questionMeans[q] = { mean: round2(avg(scores)), label: QUESTION_LABELS[q] };
      });

      // Dimension means
      const dimensionMeans = {};
      Object.entries(DIMENSIONS).forEach(([dim, { label, questions, color }]) => {
        const scores = rList.flatMap(r =>
          questions.map(q => r.answers[q]).filter(v => typeof v === 'number')
        );
        dimensionMeans[dim] = { label, mean: round2(avg(scores)), color };
      });

      const overallScores = rList.flatMap(r =>
        Object.values(r.answers.toObject ? r.answers.toObject() : r.answers)
          .filter(v => typeof v === 'number')
      );

      return {
        code,
        ...meta,
        n,
        questionMeans,
        dimensionMeans,
        overallMean: round2(avg(overallScores))
      };
    });

    res.json(result);
  } catch (err) {
    console.error('By-condition error:', err);
    res.status(500).json({ error: 'Error fetching condition analytics.' });
  }
});

// ─────────────────────────────────────────
// GET /api/analytics/by-color
// Analogous vs Complementary comparison
// ─────────────────────────────────────────
router.get('/by-color', async (req, res) => {
  try {
    const responses = await Response.find({});

    const groups = { analogous: [], complementary: [] };
    responses.forEach(r => {
      const meta = CONDITIONS[r.conditionCode];
      if (!meta) return;
      if (meta.background === 'Analogous') groups.analogous.push(r);
      else groups.complementary.push(r);
    });

    const buildStats = (rList, label) => {
      const n = rList.length;
      const questionMeans = {};
      Object.keys(QUESTION_LABELS).forEach(q => {
        const scores = rList.map(r => r.answers[q]).filter(v => typeof v === 'number');
        questionMeans[q] = { mean: round2(avg(scores)), label: QUESTION_LABELS[q] };
      });
      const dimMeans = {};
      Object.entries(DIMENSIONS).forEach(([dim, { label: dl, questions, color }]) => {
        const scores = rList.flatMap(r =>
          questions.map(q => r.answers[q]).filter(v => typeof v === 'number')
        );
        dimMeans[dim] = { label: dl, mean: round2(avg(scores)), color };
      });
      const all = rList.flatMap(r =>
        Object.values(r.answers.toObject ? r.answers.toObject() : r.answers)
          .filter(v => typeof v === 'number')
      );
      return { label, n, questionMeans, dimensionMeans: dimMeans, overallMean: round2(avg(all)) };
    };

    res.json({
      analogous: buildStats(groups.analogous, 'Analogous (Yellow-Green)'),
      complementary: buildStats(groups.complementary, 'Complementary (Yellow-Purple)')
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching color comparison.' });
  }
});

// ─────────────────────────────────────────
// GET /api/analytics/by-product
// Donut vs Tumbler vs Rolex comparison
// ─────────────────────────────────────────
router.get('/by-product', async (req, res) => {
  try {
    const responses = await Response.find({});
    const groups = { Donut: [], Tumbler: [], Rolex: [] };

    responses.forEach(r => {
      const meta = CONDITIONS[r.conditionCode];
      if (meta && groups[meta.product]) groups[meta.product].push(r);
    });

    const result = Object.entries(groups).map(([product, rList]) => {
      const n = rList.length;
      const dimMeans = {};
      Object.entries(DIMENSIONS).forEach(([dim, { label, questions, color }]) => {
        const scores = rList.flatMap(r =>
          questions.map(q => r.answers[q]).filter(v => typeof v === 'number')
        );
        dimMeans[dim] = { label, mean: round2(avg(scores)), color };
      });
      const questionMeans = {};
      Object.keys(QUESTION_LABELS).forEach(q => {
        const scores = rList.map(r => r.answers[q]).filter(v => typeof v === 'number');
        questionMeans[q] = { mean: round2(avg(scores)), label: QUESTION_LABELS[q] };
      });
      const all = rList.flatMap(r =>
        Object.values(r.answers.toObject ? r.answers.toObject() : r.answers)
          .filter(v => typeof v === 'number')
      );
      return { product, n, questionMeans, dimensionMeans: dimMeans, overallMean: round2(avg(all)) };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching product comparison.' });
  }
});

// ─────────────────────────────────────────
// GET /api/analytics/raw-responses
// Paginated raw response table
// ?page=1&limit=20&condition=a&batch=1
// ─────────────────────────────────────────
router.get('/raw-responses', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const filter = {};
    if (req.query.condition && CONDITIONS[req.query.condition]) {
      filter.conditionCode = req.query.condition;
    }
    if (req.query.batch) {
      const b = parseInt(req.query.batch);
      if (!isNaN(b)) filter.batchNumber = b;
    }

    const [responses, total] = await Promise.all([
      Response.find(filter)
        .sort({ submittedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Response.countDocuments(filter)
    ]);

    res.json({
      responses: responses.map(r => ({
        ...r,
        conditionMeta: CONDITIONS[r.conditionCode]
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching raw responses.' });
  }
});

// ─────────────────────────────────────────
// GET /api/analytics/dimensions-meta
// Returns dimension/question structure for frontend
// ─────────────────────────────────────────
router.get('/meta', async (req, res) => {
  res.json({ DIMENSIONS, QUESTION_LABELS, CONDITIONS });
});

module.exports = router;