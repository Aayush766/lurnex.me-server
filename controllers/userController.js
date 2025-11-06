const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

// --- Helper function to ensure we only return necessary student data ---
const studentProjection = '_id name email mobile course grade school status totalPaidHours hoursHistory batchId isOneOnOne';

// @desc    Register a new student from the frontend registration flow (UNCHANGED)
// @route   POST /api/auth/register-student
// @access  Public
exports.registerStudent = async (req, res) => {
    // ... (Your existing registration logic remains here, just ensure 'name' is used if the frontend sends 'studentName')
    const { name, email, mobile, course, grade, school } = req.body; // Adjusted to 'name' for consistency

    if (!name || !email || !mobile || !course || !grade || !school) {
        return res.status(400).json({ message: 'Please fill out all required fields.' });
    }

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(409).json({ message: 'A user with this email already exists.' });
        }

        const placeholderPassword = Math.random().toString(36).slice(-16);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(placeholderPassword, salt);

        const student = await User.create({
            name,
            email,
            mobile,
            course,
            grade,
            school,
            password: hashedPassword,
            role: 'student',
            status: 'pending',
            totalPaidHours: 0, // Default to 0 on initial registration
            hoursHistory: [],
            batchId: null,
            isOneOnOne: false
        });

        if (student) {
            res.status(201).json({
                _id: student._id,
                name: student.name,
                email: student.email,
                message: 'Registration successful! Awaiting admin approval.'
            });
        } else {
            res.status(400).json({ message: 'Invalid student data received.' });
        }

    } catch (error) {
        console.error("Student registration error:", error);
        res.status(500).json({ message: 'Server Error during registration.' });
    }
};


// @desc    Get a single student by ID
// @route   GET /api/admin/students/:id
// @access  Private/Admin
exports.getStudent = async (req, res) => {
    try {
        const student = await User.findById(req.params.id).select(studentProjection);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found.' });
        }

        res.json(student);
    } catch (error) {
        res.status(500).json({ message: 'Server Error: Failed to fetch student' });
    }
};

// @desc    Update a student's basic details
// @route   PATCH /api/admin/students/:id
// @access  Private/Admin
exports.updateStudentDetails = async (req, res) => {
    const studentId = req.params.id;
    // Destructure new fields: batchId and isOneOnOne
    const { name, email, mobile, course, grade, school, totalPaidHours, batchId, isOneOnOne } = req.body; 

    try {
        const student = await User.findById(studentId);

        // ... (existing logic for student not found and email check)
        
        student.name = name || student.name;
        // ... (other existing fields)
        student.school = school ?? student.school;
        student.totalPaidHours = parseFloat(totalPaidHours) >= 0 ? parseFloat(totalPaidHours) : student.totalPaidHours;

        // ✨ NEW CHANGES START HERE
        // Set new fields if they are explicitly provided in the request body
        // Note: For batchId, you may want to ensure it's a valid ObjectId or null
        if (batchId !== undefined) {
             student.batchId = batchId; 
        }
        if (isOneOnOne !== undefined) {
             student.isOneOnOne = isOneOnOne;
        }
        // ✨ NEW CHANGES END HERE

        const updatedStudent = await student.save();
        // Return the updated student object using the projection
        res.json(await User.findById(updatedStudent._id).select(studentProjection));

    } catch (error) {
        console.error("Student update error:", error);
        res.status(500).json({ message: 'Server Error during student update.' });
    }
};


exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            // ✨ Ensure all these fields are selected and exist on your User model
            .select('name email mobile course grade school status totalPaidHours totalHoursUsed hoursHistory batchId isOneOnOne enrollmentDate profilePictureUrl') 
            .populate({
                path: 'batchId',
                select: 'name timing trainer', // Select necessary batch fields
                populate: {
                    path: 'trainer',
                    select: 'name' // Only need the trainer's name
                }
            });

        if (user) {
            // NOTE: Mongoose returns a Mongoose document. We ensure it looks like JSON.
            // .toObject() can ensure a clean JS object is returned, though .json(user) usually handles this.
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server Error: Failed to fetch profile.' });
    }
};

// @desc    Update user profile (for logged-in student)
// @route   PATCH /api/users/me
// @access  Private
exports.updateMe = async (req, res) => {
    // Only allow updating the fields editable on the frontend
    const { name, mobile, course, grade, school } = req.body; 
    
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // Update fields if provided
        user.name = name || user.name;
        user.mobile = mobile || user.mobile;
        user.course = course || user.course;
        user.grade = grade || user.grade;
        user.school = school || user.school;

        await user.save();
        
        // The frontend already calls fetchUserData() after this, so a simple success message is fine.
        res.json({ message: 'Profile updated successfully' }); 

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server Error: Failed to update profile.' });
    }
};

// @desc    Log a transaction and add hours to totalPaidHours
// @route   PATCH /api/admin/students/:id/add-hours
// @access  Private/Admin
exports.addExtraHours = async (req, res) => {
    const studentId = req.params.id;
    const { hours, date, notes } = req.body;

    // Validate input
    const hoursToAdd = parseFloat(hours);
    if (!hoursToAdd || hoursToAdd <= 0 || !date) {
        return res.status(400).json({ message: 'A valid, positive number of hours and a purchase date are required.' });
    }

    try {
        const student = await User.findById(studentId);

        if (!student || student.role !== 'student') {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // 1. Update totalPaidHours
        student.totalPaidHours += hoursToAdd;

        // 2. Log the transaction in the history array
        const transaction = { 
            hours: hoursToAdd, 
            date: new Date(date).toISOString(), // Ensure date is stored as ISO string
            notes: notes || 'Manual admin addition' 
        };
        student.hoursHistory.push(transaction);

        const updatedStudent = await student.save();

        // Return the updated student object (matching what ManageStudents.jsx expects)
        res.json(await User.findById(updatedStudent._id).select(studentProjection));

    } catch (error) {
        console.error("Add extra hours error:", error);
        res.status(500).json({ message: 'Server Error: Failed to add hours.' });
    }
};



exports.createPurchaseRequest = async (req, res) => {
    // req.user is available via the 'protect' middleware
    const studentId = req.user.id; // Use req.user.id provided by 'protect' middleware
    const { hoursToBuy, calculatedPrice } = req.body;

    // Basic validation
    if (!hoursToBuy || hoursToBuy <= 0 || !calculatedPrice) {
        return res.status(400).json({ message: 'A valid number of hours and price are required.' });
    }
    
    try {
        const student = await User.findById(studentId);

        if (!student) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // Log the transaction in the history array as a PENDING request
        const transaction = { 
            hours: parseFloat(hoursToBuy), 
            date: new Date().toISOString(), 
            notes: `PURCHASE REQUEST: ${hoursToBuy} hours requested. Price: $${calculatedPrice}. Awaiting admin payment/approval.`,
            // Since there's no official 'type' field, we rely on 'notes' for now.
        };
        student.hoursHistory.push(transaction);

        await student.save();

        res.status(200).json({ 
            message: 'Purchase request submitted successfully.',
            transaction: transaction
        });

    } catch (error) {
        console.error("Purchase Request Error:", error);
        res.status(500).json({ message: 'Server Error: Failed to submit purchase request.' });
    }
};


// You'll also need to update the existing getStudents and handleCreateOrUpdateStudent 
// in your routes to include the new fields in the response.