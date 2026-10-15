/**
 * emailService.js
 *
 * Unified email service for Lurnex LMS.
 * Uses Resend (HTTPS-based) — works on Render free tier.
 *
 * Color theme sourced from the Lurnex landing page:
 *   GRADIENT_START  #1a9ed4  — sky blue (top of hero)
 *   GRADIENT_END    #0fb4a8  — teal (bottom of hero)
 *   NAVY            #0a3d62  — dark navy used for text & footer
 *   WHITE           #ffffff
 *   SURFACE         #f0f9fb  — very light teal-tinted background
 *   TEAL_ACCENT     #0fb4a8  — checkmarks, badges, highlights
 *   TEAL_LIGHT      #d0f0ee  — soft teal for strength cells / success bands
 *   AMBER_LIGHT     #fff8e1  — focus-area cell tint (unchanged)
 *   AMBER_MID       #fcd34d  — focus-area border  (unchanged)
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
const { generateResultPDF } = require('./pdfservice');

// ─── Resend client ────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM || 'noreply@lurnex.me';
const FROM_NAME_DEFAULT = 'Lurnex LMS';

const from = (name = FROM_NAME_DEFAULT) => `"${name}" <${FROM_ADDRESS}>`;

exports.sendLearnerAccountCode = async (email, code, purpose) => {
  const verification = purpose === 'verify';
  return send({
    from: from('Lurnex Accounts'), to: email,
    subject: verification ? 'Verify your Lurnex account' : 'Reset your Lurnex password',
    text: `Your Lurnex ${verification ? 'verification' : 'password reset'} code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your code is <strong>${code}</strong>.</p><p>It expires in 10 minutes and can only be used once.</p>`,
  });
};

// ─── Design tokens ───────────────────────────────────────────────────────────
// Pulled directly from the landing page screenshot gradient & UI elements.

const T = {
  gradStart:   '#1a9ed4',   // sky-blue  — hero top
  gradEnd:     '#0fb4a8',   // teal      — hero bottom
  navy:        '#0a3d62',   // dark navy — footer, step numbers, strong text
  navyDeep:    '#062a45',   // deeper navy for footer band
  white:       '#ffffff',
  surface:     '#f0f9fb',   // page background (light teal-tint)
  border:      '#cce9ef',   // card borders
  teal:        '#0fb4a8',   // primary accent (CTA, checkmarks)
  tealLight:   '#d0f0ee',   // strength / success backgrounds
  tealText:    '#0a7a72',   // text on teal-light backgrounds
  slate:       '#475569',   // body copy
  muted:       '#94a3b8',   // helper text
  amber:       '#fffbeb',   // focus-area bg
  amberBorder: '#fcd34d',   // focus-area border
  amberText:   '#92400e',   // focus-area body
  danger:      '#e11d48',   // low score band
  warn:        '#d97706',   // mid score band
};

const heroGrad = `linear-gradient(150deg, ${T.gradStart} 0%, ${T.gradEnd} 100%)`;

// ─── Helper: send ─────────────────────────────────────────────────────────────

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

// ─── Shared HTML components ───────────────────────────────────────────────────

const emailHeader = (subtitle = '') => `
  <!-- HEADER — landing page gradient -->
  <tr>
    <td style="background:${heroGrad};padding:32px 40px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <span style="color:${T.white};font-size:24px;font-weight:900;letter-spacing:-0.5px;">LURNEX</span><br>
          <span style="color:rgba(255,255,255,0.65);font-size:10px;letter-spacing:2px;text-transform:uppercase;">Learn · Grow · Excel</span>
        </td>
        ${subtitle ? `<td align="right" style="vertical-align:middle;">
          <span style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.35);border-radius:20px;padding:6px 14px;font-size:11px;font-weight:700;color:${T.white};">${subtitle}</span>
        </td>` : ''}
      </tr></table>
    </td>
  </tr>`;

const emailFooter = () => `
  <!-- FOOTER -->
  <tr>
    <td style="background:${T.navyDeep};padding:22px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <span style="color:${T.white};font-size:18px;font-weight:900;letter-spacing:-0.5px;">LURNEX</span><br>
          <span style="color:#334155;font-size:9px;letter-spacing:3px;text-transform:uppercase;">Learn · Grow · Excel</span>
        </td>
        <td align="right" style="vertical-align:middle;">
          <p style="margin:0;color:#475569;font-size:10px;text-align:right;line-height:1.6;">
            © ${new Date().getFullYear()} Lurnex. All rights reserved.<br>
            <span style="color:#334155;">Learn better. Grow ahead. Excel always.</span>
          </p>
        </td>
      </tr></table>
    </td>
  </tr>`;

const contactRow = () => `
  <tr>
    <td style="padding:20px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:${T.surface};border:1px solid ${T.border};border-radius:12px;">
        <tr><td style="padding:16px 22px;">
          <div style="font-size:10px;font-weight:700;color:${T.muted};letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Need help?</div>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:28px;">
              <a href="mailto:support@lurnex.me"
                 style="font-size:12px;color:${T.teal};text-decoration:none;font-weight:700;">📧 support@lurnex.me</a>
            </td>
            <td>
              <a href="tel:+919990054003"
                 style="font-size:12px;color:${T.teal};text-decoration:none;font-weight:700;">📞 +91-9990-054-003</a>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td>
  </tr>`;

const htmlShell = (inner) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${T.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${T.surface};padding:32px 16px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0"
       style="background:${T.white};border-radius:20px;overflow:hidden;box-shadow:0 6px 32px rgba(10,61,98,0.12);max-width:620px;">
${inner}
</table>
</td></tr>
</table>
</body>
</html>`;

// ─── Assessment result HTML ───────────────────────────────────────────────────

const buildHtml = ({ name, assessmentTitle, percentage, score, totalMarks, strengths, weaknesses, submittedAt }) => {
  const perfColor = percentage >= 70 ? T.teal : percentage >= 50 ? T.warn : T.danger;
  const perfLabel = percentage >= 70 ? 'Strong Performance' : percentage >= 50 ? 'Satisfactory' : 'Needs Improvement';
  const date = new Date(submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const insightList = (items) =>
    items.length
      ? items.map(i => `<li style="margin:6px 0;color:#334155;">• ${i}</li>`).join('')
      : `<li style="color:${T.muted};font-style:italic;">None identified</li>`;

  return htmlShell(`
  ${emailHeader('Diagnostic Report')}

  <!-- SUB-BAND -->
  <tr>
    <td style="background:${T.navy};padding:12px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <span style="color:${T.white};font-size:13px;font-weight:700;">Performance Report</span>
          <span style="color:rgba(255,255,255,0.5);font-size:12px;"> · ${assessmentTitle}</span>
        </td>
        <td align="right">
          <!-- Score badge -->
          <div style="background:${T.gradEnd};border-radius:10px;padding:8px 16px;display:inline-block;text-align:center;">
            <div style="color:${T.white};font-size:26px;font-weight:900;line-height:1;">${percentage}%</div>
            <div style="color:rgba(255,255,255,0.8);font-size:9px;font-weight:700;margin-top:3px;">${score}/${totalMarks} CORRECT</div>
          </div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- GREETING -->
  <tr>
    <td style="padding:32px 40px 0;">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${T.navy};">Great work, ${name}! 🎉</h1>
      <p style="margin:0;color:${T.slate};font-size:14px;">
        Here is your complete assessment report for <strong>${assessmentTitle}</strong>, completed on ${date}.
      </p>
    </td>
  </tr>

  <!-- SCORE BAND -->
  <tr>
    <td style="padding:24px 40px 0;">
      <div style="background:${perfColor};border-radius:12px;padding:18px 24px;">
        <span style="color:${T.white};font-size:16px;font-weight:800;">${perfLabel}</span>
        <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:6px 0 0;">
          You scored <strong>${percentage}%</strong> — ${score} out of ${totalMarks} questions correct.
        </p>
      </div>
    </td>
  </tr>

  <!-- STRENGTHS & FOCUS AREAS -->
  <tr>
    <td style="padding:24px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="48%" style="background:${T.tealLight};border-radius:12px;padding:16px;border:1px solid ${T.border};vertical-align:top;">
          <div style="color:${T.tealText};font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:10px;">✦ YOUR STRENGTHS</div>
          <ul style="margin:0;padding:0;list-style:none;font-size:13px;">${insightList(strengths)}</ul>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:${T.amber};border-radius:12px;padding:16px;border:1px solid ${T.amberBorder};vertical-align:top;">
          <div style="color:${T.warn};font-size:11px;font-weight:800;letter-spacing:1px;margin-bottom:10px;">⚡ FOCUS AREAS</div>
          <ul style="margin:0;padding:0;list-style:none;font-size:13px;">${insightList(weaknesses)}</ul>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- PDF NOTE -->
  <tr>
    <td style="padding:24px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:${T.surface};border-radius:12px;border:1px solid ${T.border};">
        <tr>
          <td style="padding:16px 20px;width:40px;font-size:24px;">📄</td>
          <td style="padding:16px 20px 16px 0;">
            <div style="font-weight:700;color:${T.navy};font-size:13px;">Your full report is attached</div>
            <div style="color:${T.muted};font-size:12px;margin-top:3px;">
              A detailed PDF with subject-wise breakdown and answer review is attached to this email.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- NEXT STEPS -->
  <tr>
    <td style="padding:24px 40px 0;">
      <div style="background:${heroGrad};border-radius:12px;padding:22px 28px;">
        <div style="color:${T.white};font-size:14px;font-weight:800;margin-bottom:8px;">What happens next?</div>
        <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:0;line-height:1.6;">
          A Lurnex academic counsellor will review your results and reach out within
          <strong style="color:${T.white};">24 hours</strong> to discuss a personalised 1:1 learning plan
          tailored to your strengths and focus areas.
        </p>
      </div>
    </td>
  </tr>

  ${contactRow()}

  <!-- SPACER -->
  <tr><td style="height:24px;"></td></tr>

  ${emailFooter()}
`);
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
 */
exports.sendLoginCredentials = async (studentEmail, temporaryPassword) => {
  const html = htmlShell(`
  ${emailHeader()}

  <tr>
    <td style="padding:32px 40px 0;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${T.navy};">Welcome to the Platform! 🎉</h1>
      <p style="color:${T.slate};font-size:14px;margin:0;">Your account has been activated. Use the credentials below to log in.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 40px 0;">
      <div style="background:${T.surface};border-radius:12px;padding:20px 24px;border:1px solid ${T.border};">
        <p style="margin:0 0 10px;font-size:11px;color:${T.muted};font-weight:700;letter-spacing:1px;text-transform:uppercase;">Your Login Details</p>
        <p style="margin:0 0 8px;font-size:14px;color:${T.navy};"><strong>Email:</strong> ${studentEmail}</p>
        <p style="margin:0;font-size:14px;color:${T.navy};">
          <strong>Temporary Password:</strong>
          <code style="background:${T.tealLight};color:${T.tealText};padding:2px 10px;border-radius:4px;font-size:13px;">${temporaryPassword}</code>
        </p>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 40px 0;">
      <div style="background:${T.amber};border-radius:12px;padding:14px 20px;border:1px solid ${T.amberBorder};">
        <p style="margin:0;font-size:13px;color:${T.amberText};">⚠️ Please change your password immediately after your first login.</p>
      </div>
    </td>
  </tr>

  ${contactRow()}
  <tr><td style="height:24px;"></td></tr>
  ${emailFooter()}
`);

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
Previous Grade: ${candidate.previousGrade || 'N/A'}
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

  // Source badge: keep semantic meaning, swap to landing-page palette
  const sourceBadgeColor =
    registeredFrom === 'Assessment Page'          ? T.teal    :
    registeredFrom === 'Admin Dashboard'          ? T.gradStart :
    registeredFrom === 'Public Registration Form' ? T.navy    :
                                                    T.slate;

  const html = htmlShell(`
  ${emailHeader('Admin Alert')}

  <!-- ALERT BAND -->
  <tr>
    <td style="background:${T.navy};padding:14px 40px;">
      <span style="color:${T.white};font-size:14px;font-weight:700;">🔔 New Student Registration</span>
    </td>
  </tr>

  <tr><td style="padding:28px 40px 0;">
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:${T.navy};">A new student just registered!</h2>
    <p style="margin:0 0 14px;color:${T.slate};font-size:14px;">Received on <strong>${enrolledDate}</strong>.</p>
    <span style="background:${sourceBadgeColor};color:${T.white};font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;">📍 ${registeredFrom}</span>
  </td></tr>

  <!-- DETAILS TABLE -->
  <tr><td style="padding:24px 40px 0;">
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-radius:12px;overflow:hidden;border:1px solid ${T.border};">
      <tr style="background:${T.navy};">
        <th style="padding:12px 16px;text-align:left;color:${T.muted};font-size:11px;width:35%;">FIELD</th>
        <th style="padding:12px 16px;text-align:left;color:${T.muted};font-size:11px;">DETAILS</th>
      </tr>
      <tr style="background:${T.surface};"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:${T.slate};border-bottom:1px solid ${T.border};">👤 Name</td><td style="padding:14px 16px;font-size:14px;font-weight:700;color:${T.navy};border-bottom:1px solid ${T.border};">${name}</td></tr>
      <tr style="background:${T.white};"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:${T.slate};border-bottom:1px solid ${T.border};">📧 Email</td><td style="padding:14px 16px;font-size:14px;border-bottom:1px solid ${T.border};"><a href="mailto:${email}" style="color:${T.teal};text-decoration:none;font-weight:600;">${email}</a></td></tr>
      <tr style="background:${T.surface};"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:${T.slate};border-bottom:1px solid ${T.border};">📱 Mobile</td><td style="padding:14px 16px;font-size:14px;color:${T.navy};border-bottom:1px solid ${T.border};">${mobile}</td></tr>
      <tr style="background:${T.white};"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:${T.slate};border-bottom:1px solid ${T.border};">📚 Course</td><td style="padding:14px 16px;font-size:14px;color:${T.navy};border-bottom:1px solid ${T.border};">${course}</td></tr>
      <tr style="background:${T.surface};"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:${T.slate};border-bottom:1px solid ${T.border};">🎯 Grade</td><td style="padding:14px 16px;font-size:14px;color:${T.navy};border-bottom:1px solid ${T.border};">${grade}</td></tr>
      <tr style="background:${T.white};"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:${T.slate};border-bottom:1px solid ${T.border};">🌍 Country</td><td style="padding:14px 16px;font-size:14px;color:${T.navy};border-bottom:1px solid ${T.border};">${country}</td></tr>
      <tr style="background:${T.surface};"><td style="padding:14px 16px;font-size:13px;font-weight:600;color:${T.slate};">📅 Enrolled On</td><td style="padding:14px 16px;font-size:14px;color:${T.navy};">${enrolledDate}</td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:24px 40px 0;">
    <div style="background:${heroGrad};border-radius:12px;padding:22px 24px;text-align:center;">
      <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:0 0 16px;">Log in to the Lurnex Admin Dashboard to review this student.</p>
      <a href="https://admin.lurnex.me"
         style="background:${T.white};color:${T.navy};text-decoration:none;padding:12px 32px;border-radius:8px;font-size:13px;font-weight:800;display:inline-block;">
        Open Admin Dashboard →
      </a>
    </div>
  </td></tr>

  <tr><td style="height:24px;"></td></tr>
  ${emailFooter()}
`);

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

  const slotDate = new Date(preferredSlot).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
  const slotTime = new Date(preferredSlot).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });

  const html = htmlShell(`
  ${emailHeader('✓ Assessment Received')}

  <!-- HERO TEXT -->
  <tr>
    <td style="padding:32px 40px 0;">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${T.navy};">Thank you, ${name}!</h1>
      <p style="margin:0;color:${T.slate};font-size:14px;line-height:1.6;">
        Your <strong>${assessmentTitle || 'Assessment'}</strong> has been successfully submitted.
        Here is what happens next.
      </p>
    </td>
  </tr>

  <!-- SECTION LABEL -->
  <tr>
    <td style="padding:28px 40px 16px;">
      <div style="font-size:10px;font-weight:800;color:${T.teal};letter-spacing:3px;text-transform:uppercase;">What happens now?</div>
    </td>
  </tr>

  <!-- STEP CARDS -->
  <tr>
    <td style="padding:0 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">

        <!-- Steps 01–03: white cards, gradient step pill -->
        ${[
          ['01', 'We Review',  'Our academic team carefully reviews the student\'s responses.'],
          ['02', 'We Analyse', 'We identify strengths, conceptual gaps and areas requiring attention.'],
          ['03', 'We Prepare', 'We prepare personalised recommendations based on performance.'],
        ].map(([num, title, body]) => `
        <tr><td style="padding-bottom:10px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:${T.white};border:1px solid ${T.border};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="width:60px;background:${heroGrad};padding:22px 0;text-align:center;vertical-align:middle;">
                <div style="font-size:11px;font-weight:800;color:${T.white};letter-spacing:1px;">${num}</div>
              </td>
              <td style="padding:16px 20px;vertical-align:middle;">
                <div style="font-size:13px;font-weight:800;color:${T.navy};margin-bottom:4px;">${title}</div>
                <div style="font-size:12px;color:${T.slate};line-height:1.55;">${body}</div>
              </td>
            </tr>
          </table>
        </td></tr>`).join('')}

        <!-- Step 04: highlighted teal card -->
        <tr><td style="padding-bottom:0;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:${T.tealLight};border:1px solid ${T.border};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="width:60px;background:${T.gradEnd};padding:22px 0;text-align:center;vertical-align:middle;">
                <div style="font-size:11px;font-weight:800;color:${T.white};letter-spacing:1px;">04</div>
              </td>
              <td style="padding:16px 20px;vertical-align:middle;">
                <div style="font-size:13px;font-weight:800;color:${T.tealText};margin-bottom:4px;">We Discuss</div>
                <div style="font-size:12px;color:${T.tealText};line-height:1.55;">Our academic counsellor will walk you through the results in detail.</div>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td>
  </tr>

  <!-- PREFERRED SLOT CARD — gradient header + navy body -->
  <tr>
    <td style="padding:28px 40px 0;">
      <div style="border-radius:18px;overflow:hidden;border:1px solid ${T.border};">
        <!-- Card header -->
        <div style="background:${heroGrad};padding:14px 24px;">
          <span style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.75);letter-spacing:3px;text-transform:uppercase;">Preferred Discussion Slot</span>
        </div>
        <!-- Card body -->
        <div style="background:${T.navy};padding:22px 24px;">
          <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
              <td style="width:30px;font-size:18px;vertical-align:middle;">📅</td>
              <td style="vertical-align:middle;">
                <div style="font-size:15px;font-weight:700;color:${T.white};line-height:1.3;">${slotDate}</div>
              </td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:30px;font-size:18px;vertical-align:middle;">🕐</td>
              <td style="vertical-align:middle;">
                <div style="font-size:15px;font-weight:700;color:${T.white};line-height:1.3;">
                  ${slotTime} <span style="font-size:12px;font-weight:600;color:${T.gradEnd};">IST</span>
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid #1e3a5f;font-size:12px;color:${T.muted};line-height:1.6;">
            Our academic counsellor will contact you to confirm your preferred time.
          </div>
        </div>
      </div>
    </td>
  </tr>

  ${contactRow()}
  <tr><td style="height:24px;"></td></tr>
  ${emailFooter()}
`);

  await send({
    from: from('Lurnex Academic Platform'),
    to: recipients,
    subject: `🎯 Your Lurnex Assessment Has Been Submitted`,
    html,
    text: `Thank you, ${name}.\n\nYour ${assessmentTitle || 'assessment'} has been submitted successfully.\n\nWHAT HAPPENS NOW?\n\n01 — We Review\nOur academic team carefully reviews the student's responses.\n\n02 — We Analyse\nWe identify strengths, conceptual gaps and areas requiring attention.\n\n03 — We Prepare\nWe prepare personalised recommendations based on the student's performance.\n\n04 — We Discuss\nOur academic counsellor will walk you through the results in detail.\n\nPREFERRED DISCUSSION\n📅 ${slotDate}\n🕐 ${slotTime} IST\n\nOur academic counsellor will contact you to confirm your preferred time.\n\nNeed help? Email support@lurnex.me or call +91-9990-054-003.\n\nLurnex — LEARN · GROW · EXCEL\n© ${new Date().getFullYear()} Lurnex. All rights reserved.`,
  });
};
