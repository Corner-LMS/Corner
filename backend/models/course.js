const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // To associate the course with a teacher
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' }, // To associate the course with a school
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], // To associate the course with questions
    modules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }], // To associate the course with modules
}, { timestamps: true });

const Course = mongoose.model('Course', courseSchema);
module.exports = Course;
