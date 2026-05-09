const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// ─────────────────────────────────────────
// POST /api/admin/login
// ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const admin = await Admin.findOne({ username: username.toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const match = await admin.comparePassword(password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, displayName: admin.displayName },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, displayName: admin.displayName, username: admin.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ─────────────────────────────────────────
// GET /api/admin/me — verify token
// ─────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json({ username: req.admin.username, displayName: req.admin.displayName });
});

module.exports = router;