/**
 * server.js – Lurnex API entry point
 *
 * Combines:
 *   - Enterprise security (helmet, cors, morgan, global error handler)
 *   - Full route registry (mis, auth, classes, assessments, admin,
 *     users, blogs, uploads, sitemap)
 *   - Mongoose connection with retry-safe timeouts
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');

// ─── Route imports ────────────────────────────────────────────────────────────

const misRoutes        = require('./routes/misRoutes');
const authRoutes       = require('./routes/authRoutes');
const classRoutes      = require('./routes/classRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const adminRoutes      = require('./routes/adminRoutes');
const userRoutes       = require('./routes/userRoutes');
const blogRoutes       = require('./routes/blogRoutes');
const uploadRoutes     = require('./routes/uploadRoutes');
const sitemapRoute     = require('./routes/sitemap');

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();

// ─── Security & parsing ───────────────────────────────────────────────────────

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/mis',         misRoutes);
app.use('/api/auth',        authRoutes);
app.use('/api/classes',     classRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/blogs',       blogRoutes);
app.use('/api/uploads',     uploadRoutes);

// Sitemap (mounted at root so /sitemap.xml resolves correctly)
app.use('/', sitemapRoute);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((req, res) =>
  res.status(404).json({ message: 'Route not found.' })
);

// ─── Global error handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// ─── Database + Start ─────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  })
  .then(() => {
    console.info('[server] MongoDB connected');
    app.listen(PORT, () =>
      console.info(`[server] Listening on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error('[server] MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;