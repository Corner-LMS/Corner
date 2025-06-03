const express = require('express');
const router = express.Router();
const {registerAdmin,verifyEmail,getVerifiedSchools} = require('../controllers/adminController');

router.post('/register-admin', registerAdmin);
router.get('/verify-email/:token', verifyEmail);
router.get('/verified-schools', getVerifiedSchools);

module.exports = router;