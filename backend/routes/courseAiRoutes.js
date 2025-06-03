const express = require('express');
const router = express.Router();
const { chatPrompt, getChatHistory } = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/chat', authMiddleware, chatPrompt);
router.get('/chat/history', authMiddleware, getChatHistory);
module.exports = router;