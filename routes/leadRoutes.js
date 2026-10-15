'use strict';

const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { createEnquiry } = require('../controllers/satMasterclassController');

const router = express.Router();
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many enquiries from this connection. Please try again later.' },
});

router.post('/sat-masterclass', enquiryLimiter, createEnquiry);

module.exports = router;
