// This is an updated authentication controller with student registration logic.
const User = require('../models/userModel'); // Assuming this handles all users (admin, student)
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Helper function to generate JWT
const generateToken = (id) => {
    // Ensure process.env.JWT_SECRET is defined in your .env file
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// --- NEW FUNCTION: Student Registration ---
exports.registerStudent = async (req, res) => {
    // 1. Destructure all fields collected from the RegistrationFlow component
    const { name, email, mobile, course, grade, school } = req.body;

    // Basic validation
    if (!name || !email || !mobile || !course || !grade || !school) {
        return res.status(400).json({ message: 'Please include all required fields.' });
    }

    try {
        // 2. Check if the user (student) already exists by email
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // 3. Set a temporary, unique initial password for the student
        // Note: The admin will eventually approve and send the *actual* login details.
        // We set a temporary password now because Mongoose might require a password field.
        // For security, use a sufficiently random string.
        const tempPassword = Math.random().toString(36).slice(-8); 
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);
        
        // 4. Create the new user with default student settings
        const user = await User.create({
            name,
            email,
            mobile,
            // Core student details from registration flow
            course,
            grade,
            school,
            // Default settings for newly registered students
            password: hashedPassword, // Store the hashed temporary password
            role: 'student',
            status: 'pending', // Payment/approval status is pending
        });

        if (user) {
            // Send back minimal success message. No token is returned yet since access is pending.
            res.status(201).json({
                _id: user.id,
                name: user.name,
                email: user.email,
                status: user.status,
                message: 'Registration successful! Awaiting admin approval.',
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error("Student Registration Error:", error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// ---------------------------------------------
// --- EXISTING FUNCTION: User Login (Modified to handle pending status) ---
// ---------------------------------------------
exports.loginUser = async (req, res) => {
    const { email, password, role } = req.body;
    
    try {
        // Attempt to find the user by email and specified role
        const user = await User.findOne({ email, role });

        if (!user) {
             return res.status(401).json({ message: 'Invalid credentials (User not found)' });
        }
        
        // Check for payment/approval status before allowing login
        if (user.role === 'student' && user.status === 'pending') {
             return res.status(403).json({ 
                 message: 'Account pending approval. Please contact support.' 
             });
        }

        // Compare provided password with hashed password
        if (await bcrypt.compare(password, user.password)) {
            res.json({
                _id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status, // Include status in response
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials (Password mismatch)' });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

exports.resetPassword = async (req, res) => {
    // ⚠️ Security check: Use the ID from the token (req.user.id) for the operation, 
    // not the one from req.params.id, to prevent a user from resetting someone else's password.
    const userId = req.user.id; 
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ message: 'New password is required.' });
    }
    
    // Optional: Add server-side strength validation to match frontend's logic
    // (e.g., regex checks for complexity)

    try {
        const user = await User.findById(userId);

        if (!user) {
            // Should not happen if `protect` middleware runs correctly
            return res.status(404).json({ message: 'User not found.' });
        }

        // 1. Hash the new password
        user.password = await hashPassword(newPassword);

        // 2. Clear the temporary password flag (assuming you added one to userModel.js)
        // **If your model doesn't have an `isTemporaryPassword` flag, you must add one to `userModel.js`**
        user.isTemporaryPassword = false; 

        await user.save();
        
        // Return a fresh token/user object to signify successful password update and bypass
        // the reset screen on the next login.
        res.status(200).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            isTemporaryPassword: false, // Explicitly false after reset
            token: generateToken(user._id),
            message: 'Password updated successfully.'
        });

    } catch (error) {
        console.error("Password Reset Server Error:", error);
        res.status(500).json({ message: 'Server Error during password reset.' });
    }
};