require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const experimentRoutes = require('./routes/experiment');
const adminRoutes      = require('./routes/admin');
const analyticsRoutes  = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS Middleware ─────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow these origins
    const allowedOrigins = [
      'http://localhost:5173',      // Vite dev
      'http://127.0.0.1:5500',     // Live Server
      'http://localhost:3000',      // CRA
      'https://web-banner-advertisement.onrender.com',  // Render prod
      'https://yourdomain.com'      // Future custom domain
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browsers
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ──────────────────────────────────────────
app.use('/api', experimentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── Static Files & SPA ─────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/admin.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ── MongoDB ────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`📊 Admin:  http://localhost:${PORT}/admin`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });