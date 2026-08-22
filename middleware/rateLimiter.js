/**
 * rateLimiter.js
 * Enterprise-grade rate limiting for public assessment endpoints.
 * Uses express-rate-limit (in-memory) – swap store to RedisStore for multi-instance deployments.
 *
 * Install: npm install express-rate-limit
 */

'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

// Helper: consistent error shape
const handler = (req, res) =>
  res.status(429).json({
    message: 'Too many requests. Please wait a moment and try again.',
    retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
  });

/**
 * Strict limiter for the public assessment start endpoint.
 * One email = one attempt per 10 minutes.
 * Keyed by IP + body.email to prevent burst from one address.
 */
exports.startAssessmentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  keyGenerator: (req) => `${ipKeyGenerator(req)}::${(req.body?.email || '').toLowerCase()}`, // suppress IPv6 keyGenerator warning
  handler,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * General API limiter – applied to all /api/assessments/public/* routes.
 */
exports.publicAssessmentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
 keyGenerator: (req) => ipKeyGenerator(req),
  validate: { trustProxy: false },
  handler,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Admin route limiter – generous but protected.
 */
exports.adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  validate: { trustProxy: false },
  handler,
  standardHeaders: true,
  legacyHeaders: false,
});