// createAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Import your User model
const User = require('./models/userModel');

// Load environment variables
dotenv.config();

const createAdminUser = async () => {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        // 2. Define the admin's data
        const adminData = {
            name: 'Admin User',
            email: 'admin@lurnex.me',
            password: 'lurnex123', // Choose a secure password
            role: 'admin' // This is the crucial part
        };

        // 3. Check if an admin with this email already exists
        const adminExists = await User.findOne({ email: adminData.email });
        if (adminExists) {
            console.log('Admin user with this email already exists.');
            mongoose.disconnect();
            return;
        }

        // 4. Hash the password before saving (Security Best Practice)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminData.password, salt);

        // 5. Create and save the new admin user
        await User.create({
            name: adminData.name,
            email: adminData.email,
            password: hashedPassword,
            role: adminData.role,
        });

        console.log('✅ Admin user created successfully!');
        console.log(`   Email: ${adminData.email}`);
        console.log(`   Password: ${adminData.password}`);

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
    } finally {
        // 6. Disconnect from the database
        await mongoose.disconnect();
        console.log('MongoDB Disconnected.');
    }
};

// Run the function
createAdminUser();