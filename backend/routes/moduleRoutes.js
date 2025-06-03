const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const moduleController = require('../controllers/moduleController');

router.post('/', authMiddleware, moduleController.createModule);
router.get('/:courseId', authMiddleware, moduleController.getCourseModules);
router.put('/:id', authMiddleware, moduleController.updateModule);
router.delete('/:id', authMiddleware, moduleController.deleteModule);

module.exports = router;
