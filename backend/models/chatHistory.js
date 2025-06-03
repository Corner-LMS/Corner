// models/ChatHistory.js
const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    prompt: { type: String, required: true },
    response: { type: String, required: true },
    resourcesRecommended: { type: [String], default: [] }, // Store recommended books/papers
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatHistory', chatHistorySchema);