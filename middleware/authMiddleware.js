// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header (e.g., "Bearer eyJhbGci...")
            token = req.headers.authorization.split(' ')[1];

            // Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get the user from the token's ID and attach it to the request object
            req.user = await User.findById(decoded.id).select('-password');
            
            // CRITICAL CHECK 1: Ensure the user actually exists in the database
            if (!req.user) {
                res.status(401).json({ message: 'Not authorized, user not found' });
                return; // STOP EXECUTION
            }

            // If everything is successful, move on
            next();

        } catch (error) {
            // This catches errors like JWT expiration or invalid signature
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
            return; // CRITICAL: STOP EXECUTION after sending 401 response
        }
    } else {
        // CRITICAL CHECK 2: Handle case where token is missing entirely
        // The original code handled this with 'if (!token)' at the end, but this is cleaner.
        res.status(401).json({ message: 'Not authorized, no token' });
        return; // CRITICAL: STOP EXECUTION
    }
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        // Changed to 403 Forbidden, which is more semantically correct for lack of permission
        res.status(403).json({ message: 'Not authorized as an admin (Forbidden)' });
        return; // CRITICAL: STOP EXECUTION
    }
};

module.exports = { protect, admin };