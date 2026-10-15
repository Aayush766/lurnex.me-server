/**
 * validators.js
 * Request validation chains for assessment endpoints.
 * Install: npm install express-validator
 */

'use strict';

const { body, param, validationResult } = require('express-validator');

/** Extracts validation errors and returns a 422 if any. */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: errors.array()[0].msg,
      errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }
  next();
};

/** Candidate registration rules */
exports.startAssessmentRules = [
  body('name')
    .trim().notEmpty().withMessage('Full name is required.')
    .isLength({ max: 100 }).withMessage('Name must be under 100 characters.'),
  body('email')
    .optional({ checkFalsy: true })
    .trim().isEmail().withMessage('Please enter a valid student email address.')
    .normalizeEmail(),
  body('mobile')
    .trim().notEmpty().withMessage('Mobile number is required.')
    .matches(/^[+\d\s\-()]{7,20}$/).withMessage('Please enter a valid mobile number.'),
  body('grade')
    .trim().notEmpty().withMessage('Current grade is required.')
    .isIn(['5','6','7','8','9','10','11','12']).withMessage('Invalid grade. Grade must be between 5 and 12.'),
  body('previousGrade')
    .trim().notEmpty().withMessage('Previous grade is required.')
    .isIn(['5','6','7','8','9','10','11','12']).withMessage('Invalid previous grade. Grade must be between 5 and 12.'),
  body('school').trim().notEmpty().withMessage('School name is required.').isLength({ max: 200 }),
  body('address').trim().notEmpty().withMessage('Address is required.').isLength({ max: 300 }),
  body('city').trim().notEmpty().withMessage('City is required.').isLength({ max: 100 }),
    body('country').trim().notEmpty().withMessage('Country is required.').isLength({ max: 100 }),
    body('curriculum').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('parentEmail').trim().notEmpty().withMessage('Parent email is required.').isEmail().withMessage('Please enter a valid parent email address.').normalizeEmail(),
  ];

/** Submit assessment rules */
exports.submitAssessmentRules = [
  param('attemptId').isMongoId().withMessage('Invalid attempt ID.'),
  body('answers').isArray().withMessage('Answers must be an array.'),
  body('answers.*.questionId').isMongoId().withMessage('Invalid question ID in answers.'),
  body('answers.*.selectedAnswer').isString().withMessage('Selected answer must be a string.'),
];

/** Admin create/update assessment rules */
exports.assessmentRules = [
  body('title').trim().notEmpty().withMessage('Assessment title is required.').isLength({ max: 200 }),
  body('duration').isInt({ min: 1, max: 300 }).withMessage('Duration must be 1–300 minutes.'),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required.'),
  body('questions.*.questionText').trim().notEmpty().withMessage('Question text is required.'),
  body('questions.*.options').isArray({ min: 2 }).withMessage('Each question needs at least 2 options.'),
  body('questions.*.correctAnswer').trim().notEmpty().withMessage('Correct answer is required.'),
];
