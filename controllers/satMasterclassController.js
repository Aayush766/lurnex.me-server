'use strict';

const User = require('../models/userModel');

const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validUrl = (value) => {
  if (!value) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;

exports.createEnquiry = async (req, res) => {
  const body = req.body || {};
  // Quietly accept honeypot submissions without storing or revealing the trap.
  if (clean(body.website, 300)) return res.status(201).json({ message: 'Enquiry received.', reference: 'received' });

  const name = clean(body.studentName, 120);
  const parentName = clean(body.parentName, 120);
  const email = clean(body.email, 254).toLowerCase();
  const mobile = clean(body.whatsappNumber, 20);
  const grade = clean(body.grade, 40);
  const focus = clean(body.satFocus, 40);
  const session = clean(body.preferredSession, 40);
  const targetDate = clean(body.targetSatDate, 40);
  const pageUrl = clean(body.pageUrl, 1000);
  const referrerUrl = clean(body.referrerUrl, 1000);
  const errors = {};

  if (name.length < 2) errors.studentName = 'Enter the student name.';
  if (!emailPattern.test(email)) errors.email = 'Enter a valid email address.';
  if (!phonePattern.test(mobile)) errors.whatsappNumber = 'Enter a WhatsApp number with country code, such as +919876543210.';
  if (!grade) errors.grade = 'Select the current grade.';
  if (!['Math', 'Reading & Writing', 'Both'].includes(focus)) errors.satFocus = 'Choose Math, Reading & Writing, or Both.';
  if (!['October 24', 'October 31', 'Both'].includes(session)) errors.preferredSession = 'Choose October 24, October 31, or Both.';
  if (!targetDate) errors.targetSatDate = 'Enter the target SAT date.';
  if (!validUrl(pageUrl)) errors.pageUrl = 'Page URL must be a valid http(s) URL.';
  if (!validUrl(referrerUrl)) errors.referrerUrl = 'Referrer URL must be a valid http(s) URL.';
  if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });

  const rawUtm = body.utm && typeof body.utm === 'object' && !Array.isArray(body.utm) ? body.utm : {};
  const satAttribution = {
    utmSource: clean(rawUtm.source), utmMedium: clean(rawUtm.medium),
    utmCampaign: clean(rawUtm.campaign), utmTerm: clean(rawUtm.term), utmContent: clean(rawUtm.content),
  };

  try {
    const lead = await User.create({
      name, email, mobile, grade, parentName, satParentName: parentName,
      course: 'SAT Master Class', leadType: 'sat_masterclass', leadSource: 'counselling_request',
      leadIntent: 'SAT Master Class enquiry', isLead: true, registeredFrom: 'SAT Master Class',
      registrationUrl: pageUrl, sourcePage: pageUrl ? new URL(pageUrl).pathname : '/sat-masterclass',
      referrerUrl: referrerUrl || null, satFocus: focus, satPreferredSession: session,
      satTargetDate: targetDate, satAttribution,
    });
    return res.status(201).json({ message: 'Your enquiry has been received.', reference: String(lead._id) });
  } catch (error) {
    // Avoid printing submitted personal data or raw database error details.
    console.error('SAT Master Class enquiry persistence failed:', error.name || 'unknown error');
    return res.status(503).json({ message: 'We could not save your enquiry. Please try again.' });
  }
};
