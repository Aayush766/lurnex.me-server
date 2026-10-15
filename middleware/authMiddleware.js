// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        res.status(401).json({ message: 'Not authorized, user not found' });
        return;
      }

<<<<<<< HEAD
      if (req.user.accountRegistration && req.user.accountStatus === 'suspended') {
        res.status(403).json({ message: 'This account is currently unavailable. Please contact support.' });
        return;
      }

=======
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
      return;
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
    return;
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res
      .status(403)
      .json({ message: 'Not authorized as an admin (Forbidden)' });
    return;
  }
};

<<<<<<< HEAD
const optionalLearner = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header) return next();
  if (!header.startsWith('Bearer ')) return res.status(401).json({ message: 'Not authorized, token failed' });
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.role !== 'student' || !user.accountRegistration || user.accountStatus === 'suspended') return res.status(401).json({ message: 'Not authorized, token failed' });
    req.user = user;
    return next();
  } catch (error) { return res.status(401).json({ message: 'Not authorized, token failed' }); }
};

module.exports = { protect, admin, optionalLearner };
=======
module.exports = { protect, admin };
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
