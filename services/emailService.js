/**
 * emailService.js
 *
 * Unified email service for Lurnex LMS.
 * Uses Resend (HTTPS-based) — works on Render free tier.
 *
 * sendLoginCredentials          – sends temporary password to new students
 * sendAssessmentResult          – branded HTML + PDF attachment
 * sendAdminLeadNotification     – internal lead alert
 * sendNewStudentRegistrationAlert – admin alert on new registration
 * sendAssessmentBookingConfirmation – booking confirmation to student/parent
 *
 * Required env vars:
 *   RESEND_API_KEY       – from resend.com dashboard
 *   EMAIL_FROM           – verified sender address e.g. noreply@yourdomain.com
 *   ADMIN_NOTIFY_EMAIL   – admin inbox for registration alerts
 *   ADMIN_EMAIL          – admin inbox for lead notifications
 */

'use strict';

const { Resend } = require('resend');
const { generateResultPDF } = require('./pdfService');

// ─── Resend client ────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

// Sender address – must be a verified domain/email in your Resend dashboard
const FROM_ADDRESS = process.env.EMAIL_FROM || 'noreply@lurnex.me';
const FROM_NAME_DEFAULT = 'Lurnex LMS';

const from = (name = FROM_NAME_DEFAULT) => `"${name}" <${FROM_ADDRESS}>`;

// ─── Helper: send with error swallowing ───────────────────────────────────────

async function send({ from: fromField, to, subject, html, text, attachments }) {
  try {
    const payload = { from: fromField || from(), to, subject, html, text };
    if (attachments) payload.attachments = attachments;
    const { data, error } = await resend.emails.send(payload);
    if (error) {
      console.error('[emailService] Resend error:', error);
      return null;
    }
    console.info(`[emailService] Sent → ${Array.isArray(to) ? to.join(', ') : to} | id: ${data?.id}`);
    return data;
  } catch (err) {
    console.error('[emailService] Unexpected error:', err.message);
    return null;
  }
}

// ─── HTML email template (assessment result) ──────────────────────────────────

const buildHtml = ({ name, assessmentTitle, percentage, score, totalMarks, strengths, weaknesses, submittedAt }) => {
  const perfColor = percentage >= 70 ? '#059669' : percentage >= 50 ? '#d97706' : '#e11d48';
  const perfLabel = percentage >= 70 ? 'Strong Performance' : percentage >= 50 ? 'Satisfactory' : 'Needs Improvement';
  const date = new Date(submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const insightList = (items) =>
    items.length
      ? items.map(i => `<li style="margin:6px 0;color:#334155;">• ${i}</li>`).join('')
      : `<li style="color:#94a3b8;font-style:italic;">None identified</li>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- HEADER -->
  <tr>
    <td style="background:#0a192f;padding:28px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">LURNEX</span><br>
          <span style="color:#64748b;font-size:11px;">Learn better. Grow ahead. Excel always.</span>
        </td>
        <td align="right">
          <div style="background:#059669;border-radius:12px;padding:12px 20px;display:inline-block;text-align:center;">
            <div style="color:#ffffff;font-size:32px;font-weight:800;line-height:1;">${percentage}%</div>
            <div style="color:#a7f3d0;font-size:10px;font-weight:600;margin-top:4px;">${score}/${totalMarks} CORRECT</div>
          </div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- SUB-HEADER -->
  <tr>
    <td style="background:#059669;padding:14px 36px;">
      <span style="color:#ffffff;font-size:13px;font-weight:700;">Diagnostic Performance Report</span>
      <span style="color:#a7f3d0;font-size:12px;"> · ${assessmentTitle}</span>
    </td>
  </tr>

  <!-- GREETING -->
  <tr>
    <td style="padding:32px 36px 0;">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Great work, ${name}! 🎉</h1>
      <p style="margin:0;color:#64748b;font-size:14px;">Here is your complete assessment report for <strong>${assessmentTitle}</strong>, completed on ${date}.</p>
    </td>
  </tr>

  <!-- SCORE BAND -->
  <tr>
    <td style="padding:24px 36px 0;">
      <div style="background:${perfColor};border-radius:12px;padding:18px 24px;">
        <span style="color:#ffffff;font-size:16px;font-weight:800;">${perfLabel}</span>
        <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0;">
          You scored <strong>${percentage}%</strong> — ${score} out of ${totalMarks} questions correct.
        </p>
      </div>
    </td>
  </tr>

  <!-- STRENGTHS & FOCUS AREAS -->
  <tr>
    <td style="padding:24px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="48%" style="background:#ecfdf5;border-radius:12px;padding:16px;border:1px solid #a7f3d0;vertical-align:top;">
          <div style="color:#059669;font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:10px;">✦ YOUR STRENGTHS</div>
          <ul style="margin:0;padding:0;list-style:none;font-size:13px;">${insightList(strengths)}</ul>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:#fffbeb;border-radius:12px;padding:16px;border:1px solid #fcd34d;vertical-align:top;">
          <div style="color:#d97706;font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:10px;">⚡ FOCUS AREAS</div>
          <ul style="margin:0;padding:0;list-style:none;font-size:13px;">${insightList(weaknesses)}</ul>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- PDF NOTE -->
  <tr>
    <td style="padding:24px 36px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <tr>
          <td style="padding:16px 20px;width:40px;font-size:24px;">📄</td>
          <td style="padding:16px 20px 16px 0;">
            <div style="font-weight:700;color:#0f172a;font-size:13px;">Your full report is attached</div>
            <div style="color:#64748b;font-size:12px;margin-top:3px;">A detailed PDF with subject-wise breakdown and answer review is attached to this email.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- NEXT STEPS -->
  <tr>
    <td style="padding:24px 36px 0;">
      <div style="background:#0a192f;border-radius:12px;padding:20px 24px;">
        <div style="color:#ffffff;font-size:14px;font-weight:800;margin-bottom:8px;">What happens next?</div>
        <p style="color:#94a3b8;font-size:13px;margin:0;line-height:1.6;">
          A Lurnex academic counsellor will review your results and reach out within
          <strong style="color:#6ee7b7;">24 hours</strong> to discuss a personalised 1:1 learning plan
          tailored to your strengths and focus areas.
        </p>
      </div>
    </td>
  </tr>

  <!-- CONTACT -->
  <tr>
    <td style="padding:24px 36px;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        Questions? Reach us at
        <a href="mailto:support@lurnex.me" style="color:#059669;text-decoration:none;font-weight:700;">support@lurnex.me</a>
        or call <a href="tel:+919990054003" style="color:#059669;text-decoration:none;font-weight:700;">+91-9990-054-003</a>
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#0a192f;padding:16px 36px;border-top:1px solid #1e293b;">
      <p style="margin:0;color:#475569;font-size:11px;text-align:center;">
        © ${new Date().getFullYear()} Lurnex. All rights reserved.<br>
        This email was sent to ${name} because they completed an assessment on the Lurnex platform.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
};

// ─── Plain-text fallback ──────────────────────────────────────────────────────

const buildText = ({ name, assessmentTitle, percentage, score, totalMarks, strengths, weaknesses }) => `
Hi ${name},

Congratulations on completing your ${assessmentTitle}!

OVERALL SCORE: ${percentage}% (${score}/${totalMarks} correct)

STRENGTHS:
${strengths.length ? strengths.map(s => `  • ${s}`).join('\n') : '  None identified'}

FOCUS AREAS:
${weaknesses.length ? weaknesses.map(w => `  • ${w}`).join('\n') : '  None identified'}

Your detailed report PDF is attached.
A Lurnex counsellor will contact you within 24 hours to discuss your personalised learning plan.

Need help? Email us at support@lurnex.me or call +91-9990-054-003.

– The Lurnex Team
`;

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Sends login credentials to a newly activated student.
 *
 * @param {string} studentEmail      Recipient email address
 * @param {string} temporaryPassword Plain-text temporary password
 */
exports.sendLoginCredentials = async (studentEmail, temporaryPassword) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
      <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0a192f;padding:24px 36px;">
            <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">LURNEX</span><br>
            <span style="color:#64748b;font-size:11px;">Learn better. Grow ahead. Excel always.</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 0;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Welcome to the Platform! 🎉</h1>
            <p style="color:#64748b;font-size:14px;margin:0;">Your account has been activated. Use the credentials below to log in.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px 0;">
            <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;border:1px solid #e2e8f0;">
              <p style="margin:0 0 10px;font-size:13px;color:#64748b;font-weight:600;">YOUR LOGIN DETAILS</p>
              <p style="margin:0 0 6px;font-size:14px;color:#0f172a;"><strong>Email:</strong> ${studentEmail}</p>
              <p style="margin:0;font-size:14px;color:#0f172a;"><strong>Temporary Password:</strong> <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;">${temporaryPassword}</code></p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px 0;">
            <div style="background:#fffbeb;border-radius:12px;padding:14px 20px;border:1px solid #fcd34d;">
              <p style="margin:0;font-size:13px;color:#92400e;">⚠️ Please change your password immediately after your first login.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 36px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Need help? Contact us at
              <a href="mailto:support@lurnex.me" style="color:#059669;text-decoration:none;font-weight:700;">support@lurnex.me</a>
              or call <a href="tel:+919990054003" style="color:#059669;text-decoration:none;font-weight:700;">+91-9990-054-003</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#0a192f;padding:16px 36px;border-top:1px solid #1e293b;">
            <p style="margin:0;color:#475569;font-size:11px;text-align:center;">
              © ${new Date().getFullYear()} Lurnex. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
      </td></tr>
      </table>
    </body>
    </html>
  `;

  await send({
    from: from('Lurnex LMS'),
    to: studentEmail,
    subject: 'Welcome to Lurnex LMS! Your Login Credentials',
    html,
    text: `Welcome to Lurnex LMS!\n\nYour account has been activated.\n\nEmail: ${studentEmail}\nTemporary Password: ${temporaryPassword}\n\nPlease change your password after your first login.\n\nNeed help? Email support@lurnex.me or call +91-9990-054-003.\n\n– The Lurnex Team`,
  });
};

/**
 * Sends the assessment result email with branded HTML and a PDF report attached.
 *
 * @param {Object} params
 * @param {string} params.to
 * @param {string} params.name
 * @param {string} [params.grade]
 * @param {string} [params.school]
 * @param {string} params.assessmentTitle
 * @param {number} params.percentage
 * @param {number} params.score
 * @param {number} params.totalMarks
 * @param {Array}  [params.subjectAnalysis]
 * @param {Array}  [params.strengths]
 * @param {Array}  [params.weaknesses]
 * @param {Date}   [params.submittedAt]
 */
exports.sendAssessmentResult = async (params) => {
  const {
    to, name, grade = '', school = '', assessmentTitle,
    percentage, score, totalMarks,
    subjectAnalysis = [], strengths = [], weaknesses = [],
    submittedAt = new Date(),
  } = params;

  try {
    const pdfBuffer = await generateResultPDF({
      candidateName: name,
      candidateEmail: to,
      candidateGrade: grade,
      candidateSchool: school,
      assessmentTitle,
      score,
      totalMarks,
      percentage,
      subjectAnalysis,
      strengths,
      weaknesses,
      submittedAt,
    });

    const safeFileName = `Lurnex_Report_${name.replace(/\s+/g, '_')}_${new Date(submittedAt).toISOString().slice(0, 10)}.pdf`;

    return await send({
      from: from('Lurnex Academic Platform'),
      to,
      subject: `Your Assessment Report – ${percentage}% | ${assessmentTitle}`,
      html: buildHtml({ name, assessmentTitle, percentage, score, totalMarks, strengths, weaknesses, submittedAt }),
      text: buildText({ name, assessmentTitle, percentage, score, totalMarks, strengths, weaknesses }),
      attachments: [{ filename: safeFileName, content: pdfBuffer.toString('base64') }],
    });
  } catch (err) {
    console.error('[emailService] Failed to send result email:', err.message);
  }
};

/**
 * Sends an internal admin notification when a new lead submits an assessment.
 *
 * @param {Object} candidate  Candidate snapshot
 * @param {number} percentage Score percentage
 */
exports.sendAdminLeadNotification = async (candidate, percentage) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFY_EMAIL;
  if (!adminEmail) return;

  await send({
    from: from('Lurnex Platform'),
    to: adminEmail,
    subject: `New Lead: ${candidate.name} (Grade ${candidate.grade}) – ${percentage}%`,
    text: `
New assessment submission received.

Name:    ${candidate.name}
Email:   ${candidate.email}
Mobile:  ${candidate.mobile}
Grade:   ${candidate.grade}
School:  ${candidate.school}
City:    ${candidate.city}, ${candidate.country}
Score:   ${percentage}%
Time:    ${new Date().toISOString()}

Log in to the Lurnex admin dashboard to review this lead.
    `.trim(),
  });
};

/**
 * Sends a rich HTML admin alert whenever any new student registers.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} [params.mobile]
 * @param {string} [params.course]
 * @param {string} [params.grade]
 * @param {string} [params.country]
 * @param {string} [params.enrolledOn]
 * @param {string} [params.registeredFrom]
 */
exports.sendNewStudentRegistrationAlert = async (params) => {
  const adminEmail =
    process.env.ADMIN_NOTIFY_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.EMAIL_FROM;

  if (!adminEmail) {
    console.warn('[emailService] No admin email configured – skipping registration alert.');
    return;
  }

  const {
    name = 'N/A',
    email = 'N/A',
    mobile = 'N/A',
    course = 'N/A',
    grade = 'N/A',
    country = 'N/A',
    enrolledOn,
    registeredFrom = 'Unknown',
  } = params;

  const enrolledDate = enrolledOn
    ? new Date(enrolledOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const sourceBadgeColor =
    registeredFrom === 'Assessment Page'          ? '#7c3aed' :
    registeredFrom === 'Admin Dashboard'          ? '#0284c7' :
    registeredFrom === 'Public Registration Form' ? '#059669' :
                                                    '#64748b';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr>
    <td style="background:#0a192f;padding:28px 36px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><span style="color:#ffffff;font-size:22px;font-weight:800;">LURNEX</span><br>
          <span style="color:#64748b;font-size:11px;">Admin Notification System</span></td>
        <td align="right"><div style="background:#059669;border-radius:50%;width:50px;height:50px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;">🎓</div></td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="background:#059669;padding:14px 36px;">
    <span style="color:#ffffff;font-size:14px;font-weight:700;">🔔 New Student Registration Alert</span>
  </td></tr>
  <tr><td style="padding:28px 36px 0;">
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0f172a;">A new student just registered!</h2>
    <p style="margin:0;color:#64748b;font-size:14px;">Received on <strong>${enrolledDate}</strong>.</p>
    <div style="margin-top:14px;">
      <span style="background:${sourceBadgeColor};color:#ffffff;font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;">📍 ${registeredFrom}</span>
    </div>
  </td></tr>
  <tr><td style="padding:24px 36px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr style="background:#0a192f;">
        <th style="padding:12px 16px;text-align:left;color:#94a3b8;font-size:11px;width:35%;">FIELD</th>
        <th style="padding:12px 16px;text-align:left;color:#94a3b8;font-size:11px;">DETAILS</th>
      </tr>
      <tr style="background:#f8fafc;"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">👤 Name</td><td style="padding:14px 16px;font-size:14px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;">${name}</td></tr>
      <tr style="background:#ffffff;"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">📧 Email</td><td style="padding:14px 16px;font-size:14px;border-bottom:1px solid #e2e8f0;"><a href="mailto:${email}" style="color:#059669;text-decoration:none;font-weight:600;">${email}</a></td></tr>
      <tr style="background:#f8fafc;"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">📱 Mobile</td><td style="padding:14px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0;">${mobile}</td></tr>
      <tr style="background:#ffffff;"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">📚 Course</td><td style="padding:14px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0;">${course}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">🎯 Grade</td><td style="padding:14px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0;">${grade}</td></tr>
      <tr style="background:#ffffff;"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">🌍 Country</td><td style="padding:14px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #e2e8f0;">${country}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:#475569;">📅 Enrolled On</td><td style="padding:14px 16px;font-size:14px;color:#0f172a;">${enrolledDate}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 36px 0;">
    <div style="background:#0a192f;border-radius:12px;padding:20px 24px;text-align:center;">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 14px;">Log in to the Lurnex Admin Dashboard to review this student.</p>
      <a href="https://admin.lurnex.me" style="background:#059669;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:13px;font-weight:700;display:inline-block;">Open Admin Dashboard →</a>
    </div>
  </td></tr>
  <tr><td style="padding:24px 36px;">
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Automated notification · © ${new Date().getFullYear()} Lurnex. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  await send({
    from: from('Lurnex Admin Alert'),
    to: adminEmail,
    subject: `New Student Registered - ${name} | ${registeredFrom}`,
    html,
    text: `NEW STUDENT REGISTRATION\n\nName: ${name}\nEmail: ${email}\nMobile: ${mobile}\nCourse: ${course}\nGrade: ${grade}\nCountry: ${country}\nRegistered From: ${registeredFrom}\nEnrolled On: ${enrolledDate}\n\nhttps://admin.lurnex.me`,
  });
};

/**
 * Sends booking confirmation to student and parent after slot selection.
 */
exports.sendAssessmentBookingConfirmation = async ({ studentEmail, parentEmail, name, assessmentTitle, preferredSlot }) => {
  const recipients = [...new Set([studentEmail, parentEmail].filter(Boolean))];
  if (!recipients.length) return;

  const slot = new Date(preferredSlot).toLocaleString('en-IN', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#0f172a">
      <div style="background:#0a192f;color:#fff;padding:22px 28px;border-radius:14px 14px 0 0"><strong style="font-size:22px">LURNEX</strong></div>
      <div style="border:1px solid #e2e8f0;padding:28px;border-radius:0 0 14px 14px">
        <h1 style="margin-top:0">Thank you, ${name}!</h1>
        <p>Your ${assessmentTitle || 'assessment'} has been submitted successfully.</p>
        <p>Your preferred slot for the result discussion is:</p>
        <p style="background:#ecfdf5;border:1px solid #a7f3d0;padding:14px;border-radius:10px;font-weight:bold;color:#047857">${slot} (IST)</p>
        <p>Our academic counsellor will review the request and contact you to confirm the discussion.</p>
      </div>
    </div>`;

  await send({
    from: from('Lurnex Academic Platform'),
    to: recipients,
    subject: 'Thank you – your result discussion slot preference',
    html,
    text: `Thank you, ${name}. Your ${assessmentTitle || 'assessment'} has been submitted. Your preferred result discussion slot is ${slot} (IST). A Lurnex counsellor will contact you to confirm it.`,
  });
};
