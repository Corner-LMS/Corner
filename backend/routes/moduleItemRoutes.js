const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const moduleItemController = require('../controllers/moduleItemController');
const upload = require('../utilities/multerConfig');

router.post('/', authMiddleware, upload.single('file'), moduleItemController.createModuleItem);
router.get('/:moduleId', authMiddleware, moduleItemController.getModuleItems);
router.put('/:id', authMiddleware, upload.single('file'), moduleItemController.updateModuleItem);
router.delete('/:id', authMiddleware, moduleItemController.deleteModuleItem);

module.exports = router;
