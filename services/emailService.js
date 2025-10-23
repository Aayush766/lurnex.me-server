// services/emailService.js
const nodemailer = require('nodemailer');

// Create a "transporter" - an object that can send email
// We configure it to use Gmail's servers
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your email from .env
        pass: process.env.EMAIL_PASS, // Your App Password from .env
    },
});

/**
 * @description Sends an email with login credentials to a new student.
 * @param {string} studentEmail - The recipient's email address.
 * @param {string} temporaryPassword - The plain-text password to be sent.
 */
exports.sendLoginCredentials = async (studentEmail, temporaryPassword) => {
    const mailOptions = {
        from: `"Lurnex LMS" <${process.env.EMAIL_USER}>`,
        to: studentEmail,
        subject: 'Welcome to Lurnex LMS! Your Login Credentials',
        html: `
            <h1>Welcome to the Platform!</h1>
            <p>Your account has been activated. You can now log in using these credentials:</p>
            <ul>
                <li><strong>Email:</strong> ${studentEmail}</li>
                <li><strong>Temporary Password:</strong> ${temporaryPassword}</li>
            </ul>
            <p>Please change your password after your first login.</p>
            <p>Thank you!</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Login credentials email sent successfully to ${studentEmail}`);
    } catch (error) {
        console.error(`Failed to send email to ${studentEmail}:`, error);
        // In a real app, you might want to handle this error more gracefully
    }
};