const ModuleItem = require('../models/moduleItem');
const path = require('path');
const Module = require('../models/module');
const multer = require('multer');
const upload = require('../utilities/multerConfig');
const s3 = require('../utilities/s3Config');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

// create module item
const createModuleItem = async (req, res) => {
    try {
        const { moduleId, title, type, content } = req.body;

        // Verify the teacher owns the module
        const module = await Module.findOne({
            _id: moduleId,
            teacherId: req.user.userId
        });

        if (!module) {
            return res.status(403).json({ msg: 'Not authorized to add content to this module' });
        }
        if (!req.user?.userId) {
            return res.status(403).json({ msg: 'Unauthorized: No teacher ID found' });
        }

        // Get next position
        const lastItem = await ModuleItem.findOne({ moduleId })
            .sort({ position: -1 })
            .limit(1);
        const position = lastItem ? lastItem.position + 1 : 0;

        // Create item based on type
        let itemData = {
            title,
            type,
            moduleId,
            position,
            teacherId: req.user.userId
        };

        if (type === 'text') {
            itemData.content = { text: content.text };
        } else if (type === 'link') {
            itemData.content = { url: content.url };
        } else if (req.file) {
            const ext = path.extname(req.file.originalname);
            const fileName = `module-items/${Date.now()}${ext}`;
            const uploadParams = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: fileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype
            };
            await s3.send(new PutObjectCommand(uploadParams));
            const fileUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
            itemData.file = {
                path: fileUrl,
                key: fileName,
                mimetype: req.file.mimetype,
                size: req.file.size,
                originalname: req.file.originalname
            };
        } else {
            return res.status(400).json({ msg: 'File is required for this content type' });
        }

        const newItem = new ModuleItem(itemData);
        await newItem.save();

        res.status(201).json(newItem);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// get all module items
const getModuleItems = async (req, res) => {
    try {
        const module = await Module.findById(req.params.moduleId);

        if (!module) {
            return res.status(404).json({ msg: 'Module not found' });
        }

        // Check permissions
        // const isTeacher = module.teacherId.equals(req.user.userId);
        // const query = { moduleId: req.params.moduleId };

        // if (!isTeacher) {
        //     query.isPublished = true;
        // }

        const items = await ModuleItem.find({ moduleId: req.params.moduleId })
            .sort({ position: 1 });

        res.json(items);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// update module item
const updateModuleItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, type, content, url } = req.body;

        const item = await ModuleItem.findById(id);

        if (!item) {
            return res.status(404).json({ msg: 'Module item not found' });
        }

        // Check permissions
        const isTeacher = item.teacherId.equals(req.user.userId);

        if (!isTeacher) {
            return res.status(403).json({ msg: 'Not authorized to update this item' });
        }

        // Update item
        item.title = title;
        item.type = type;
        if (type === 'text' && content?.text) {
            item.content = { text: content.text }; // Override fully (or merge if needed)
        }
        else if (type === 'link' && content?.url) {
            item.content = { url: content.url };
        }
        if (req.file) {
            item.file = {
                path: req.file.path,
                mimetype: req.file.mimetype,
                size: req.file.size,
                originalname: req.file.originalname
            };
        }

        await item.save();
        res.json(item);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// delete module item
const deleteModuleItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await ModuleItem.findById(id);

        if (!item) {
            return res.status(404).json({ msg: 'Module item not found' });
        }

        if (!item.teacherId || !req.user?.userId) {
            return res.status(403).json({ msg: 'Unauthorized: Missing teacher ID' });
        }
        const isTeacher = item.teacherId.toString() === req.user.userId.toString();

        if (!isTeacher) {
            return res.status(403).json({ msg: 'Not authorized to delete this item' });
        }

        await item.deleteOne();

        res.json({ msg: 'Module item deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: err.message, error: err.stack});
    }
};

module.exports = {
    createModuleItem,
    getModuleItems,
    updateModuleItem,
    deleteModuleItem
};