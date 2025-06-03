// models/Module.js
const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Module title is required'],
        trim: true,
        maxlength: [100, 'Module title cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: [true, 'Course ID is required']
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Teacher ID is required']
    },
    items: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModuleItem'
    }],
    isPublished: {
        type: Boolean,
        default: false
    },
    position: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Module', moduleSchema);