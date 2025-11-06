const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { 
    getDashboardStats,
    getAllStudents,
    updateStudentStatus,
    
    // Trainer Controller Imports
    createTrainer,
    updateTrainer, 
    deleteTrainer, 
    getAllTrainers, // ✨ ONLY ONE IMPORT HERE
    
    // Class/Schedule Controller Imports
    scheduleClassForTrainer,
    getAllClasses,
    updateClassRecording,
    scheduleBulkClasses,
    
    // Existing Student Controller Imports
    createStudentByAdmin, 
    getStudent, 
    updateStudentDetails,
    addExtraHours,
    transferStudent,
    
    // Batch Controller Imports
    createBatch, 
    getAllBatches, 
    getBatchDetails,
    updateBatch
} = require('../controllers/adminController'); 

// All routes in this file are protected and require admin access
router.use(protect, admin);

router.get('/stats', getDashboardStats);

// -------------------------------------------------------------
// ADMIN STUDENT MANAGEMENT ROUTES 
// -------------------------------------------------------------
router.get('/students', getAllStudents);
router.post('/students', createStudentByAdmin);
router.get('/students/:id', getStudent);
router.patch('/students/:id', updateStudentDetails);
router.patch('/students/:id/status', updateStudentStatus);
router.patch('/students/:id/add-hours', addExtraHours);
router.patch('/students/:id/transfer', transferStudent); 

// -------------------------------------------------------------
// TRAINER ROUTES 
// -------------------------------------------------------------
router.get('/trainers', getAllTrainers); // The required route to fetch trainers
router.post('/trainers', createTrainer);
router.put('/trainers/:id', updateTrainer);
router.delete('/trainers/:id', deleteTrainer);

// -------------------------------------------------------------
// CLASS & BATCH ROUTES
// -------------------------------------------------------------

router.post('/classes/bulk', scheduleBulkClasses);
router.post('/classes', scheduleClassForTrainer);
router.get('/classes', getAllClasses);
router.patch('/classes/:id/recording', updateClassRecording); 
router.post('/batches', createBatch);
router.get('/batches', getAllBatches);
router.get('/batches/:id', getBatchDetails);
router.patch('/batches/:id', updateBatch);

module.exports = router;