const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { updateMe } = require('../controllers/userController');
const { learnerOnly, getProfile, uploadAvatar, dashboard } = require('../controllers/learnerController');
const upload = require('../middleware/uploadMiddleware');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const readLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const writeLimit = rateLimit({ windowMs: 60_000, max: 15, standardHeaders: true, legacyHeaders: false });
const avatarUpload = (req, res, next) => upload.single('avatar')(req, res, (error) => {
  if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Avatar must be 5 MB or smaller.' : 'Only JPEG, PNG, or WebP images are allowed.' });
  next();
});
router.use(protect, learnerOnly);
router.get('/me', readLimit, getProfile);
router.patch('/me', writeLimit, updateMe);
router.post('/me/avatar', writeLimit, avatarUpload, uploadAvatar);
router.get('/me/dashboard', readLimit, dashboard);
module.exports = router;
