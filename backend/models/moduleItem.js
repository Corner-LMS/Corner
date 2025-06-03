// models/ModuleItem.js
const mongoose = require('mongoose');

const moduleItemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    type: {
        type: String,
        enum: ['text', 'video', 'document', 'quiz', 'assignment', 'link'],
        required: true
    },
    content: {
        // For text content or external links
        text: String,
        url: String
    },
    file: {
        // For uploaded files
        path: String,
        mimetype: String,
        size: Number,
        originalname: String
    },
    moduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    position: Number,
    isPublished: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('ModuleItem', moduleItemSchema);