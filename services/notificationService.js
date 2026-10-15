// This service is a placeholder.
// You should replace it with your actual email sending logic (e.g., using SendGrid, Nodemailer, or your existing emailService.js)

/**
 * Sends a cancellation notification email.
 * This is a mock service. Replace with your actual email logic.
 *
 * @param {Array} students - Array of student user objects (must have .email and .name)
 * @param {Object} trainer - Trainer user object (must have .email and .name)
 * @param {Object} classInfo - The class object that was cancelled (must have .title, .startTime)
 * @param {string} reason - The reason for cancellation
 * @param {string} cancelledBy - Who cancelled the class (e.g., 'trainer', 'student', 'admin')
 */
exports.sendCancellationNotification = async (students, trainer, classInfo, reason, cancelledBy) => {
    
    const classTitle = classInfo.title;
    const classTime = new Date(classInfo.startTime).toLocaleString('en-IN', {
        dateStyle: 'full',
        timeStyle: 'short'
    });
    
    const studentEmails = students.map(s => s.email);
    const trainerEmail = trainer.email;

    const allRecipients = [...studentEmails, trainerEmail];

    const subject = `CLASS CANCELLATION: ${classTitle}`;
    
    const messageBody = `
        <p>Hello,</p>
        <p>This is an automated notification to inform you that the following class has been <strong>cancelled</strong>:</p>
        
        <ul>
            <li><strong>Class:</strong> ${classTitle}</li>
            <li><strong>Time:</strong> ${classTime}</li>
            <li><strong>Trainer:</strong> ${trainer.name}</li>
        </ul>
        
        <p>
            <strong>Cancelled By:</strong> ${cancelledBy.charAt(0).toUpperCase() + cancelledBy.slice(1)}<br/>
            <strong>Reason:</strong> ${reason}
        </p>
        
        <p>No hours will be deducted from student accounts for this class. Please check your dashboard for any schedule updates.</p>
        
        <p>We apologize for any inconvenience.</p>
        
        <p>Sincerely,<br/>The Admin Team</p>
    `;

    // --- YOUR EMAIL LOGIC GOES HERE ---
    // For example, if you use your existing emailService.js:
    //
    // const { sendEmail } = require('./emailService'); // Adjust path as needed
    //
    // for (const email of allRecipients) {
    //     try {
    //         await sendEmail({
    //             to: email,
    //             subject: subject,
    //             html: messageBody
    //         });
    //         console.log(`Cancellation notification sent successfully to ${email}`);
    //     } catch (error) {
    //         console.error(`Failed to send cancellation email to ${email}:`, error);
    //     }
    // }

    // Mock console log to show it's working:
    console.log("--- SENDING CANCELLATION NOTIFICATION ---");
    console.log("Subject:", subject);
    console.log("Recipients:", allRecipients.join(', '));
    console.log("Body:", messageBody.replace(/<[^>]*>?/gm, '')); // Log plain text version
    console.log("-----------------------------------------");

    // In a real implementation, you would await your email sending function.
    return Promise.resolve();
};