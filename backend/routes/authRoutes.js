// routes/authRoutes.js
const express = require('express');
const { signup, login,  verifyEmail } = require('../controllers/authController');
const router = express.Router();

// router.post('/register-school', registerSchool);
router.post('/signup', signup);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);
module.exports = router;
