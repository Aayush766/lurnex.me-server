// createStudent.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
<<<<<<< HEAD
const connectDatabase = require('./config/connectDatabase');
=======
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86

// Import your User model
const User = require('./models/userModel');

// Load environment variables from .env file
dotenv.config();

const createSampleStudent = async () => {
    try {
        // 1. Connect to your MongoDB database
<<<<<<< HEAD
        await connectDatabase();
=======
        await mongoose.connect(process.env.MONGO_URI);
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
        console.log('MongoDB Connected...');

        // 2. Define the new student's data
        const studentData = {
            name: 'Aayush Verma',
            email: 'blaze.aayush23@gmail.com',
            password: 'lurnex123', // Plain text password
            role: 'student'
        };

        // 3. Check if the student already exists
        const userExists = await User.findOne({ email: studentData.email });
        if (userExists) {
            console.log('Student with this email already exists.');
            mongoose.disconnect();
            return;
        }

        // 4. Hash the password before saving (VERY IMPORTANT)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(studentData.password, salt);

        // 5. Create and save the new student document
        await User.create({
            name: studentData.name,
            email: studentData.email,
            password: hashedPassword,
            role: studentData.role,
        });

        console.log('✅ Sample student created successfully!');
        console.log(`   Email: ${studentData.email}`);
        console.log(`   Password: ${studentData.password}`);

    } catch (error) {
        console.error('❌ Error creating student:', error.message);
    } finally {
        // 6. Disconnect from the database
        await mongoose.disconnect();
        console.log('MongoDB Disconnected.');
    }
};

// Run the function
<<<<<<< HEAD
createSampleStudent();
=======
createSampleStudent();
>>>>>>> df0a909acaa384d97f588a44aa8d8a80e4356e86
