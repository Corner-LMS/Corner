const mongoose = require('mongoose');



const questionSchema = new mongoose.Schema({
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Teacher or Student
    content: { type: String, required: true },
    title: { type: String, required: true },
    isAnonymous: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    comments: [
        {
            text: { type: String, required: true },
            author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            timestamp: { type: Date, default: Date.now },
        },
    ],
});

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
