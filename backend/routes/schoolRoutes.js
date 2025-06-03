const express = require('express');
const router = express.Router();
const { registerSchool, getAllSchools } = require('../controllers/authController');

// Route to register a new school
router.post('/register-school', registerSchool);

// Route to fetch all registered schools
router.get('/schools', getAllSchools);

module.exports = router;