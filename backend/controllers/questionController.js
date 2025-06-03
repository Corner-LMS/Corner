// controllers/questionController.js
const Question = require('../models/question');
const Course = require('../models/course');


const addQuestion = async (req, res,io) => {
    const { courseId, content, title,isAnonymous } = req.body;
    const user = req.user;
    const userId = user.userId;
    console.log("user id: ", userId);

    if(!title || !content || !courseId)
    {
        return res.status(400).json({ msg: 'Title, content and courseId are required' });
    }

    try {
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }

        const question = new Question({ courseId, createdBy: userId, content, title, isAnonymous:isAnonymous||false });
        await question.save();
        const populatedQuestion = await question.populate('createdBy', 'name role');

        // Optionally, add the question ID to the course's questions array
        course.questions.push(question._id);
        await course.save();

        io.to(courseId).emit('newQuestion', populatedQuestion);

        res.status(201).json({ message: 'Question added successfully', question: populatedQuestion });
    } catch (error) {
        res.status(500).json({ msg: 'Failed to add question', error: error.message });
    }
};


const addComment = async (req, res,io) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const user = req.user;
        const userId = user.userId;

        if (!text) {
            return res.status(400).json({ message: 'Comment text is required' });
        }
        if(!userId)
        {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const question = await Question.findById(id);
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }

        const newComment = { text, author: userId,timestamp:new Date()};
        question.comments.push(newComment);
        await question.save();
        const updatedQuestion = await Question.findById(id)
            .populate('comments.author', 'name role')
            .sort({ 'comments.timestamp': -1 });
        io.to(id).emit('newComment', { questionId: id, updatedComments: updatedQuestion.comments });

        // Get the last comment
        // const addedComment = updatedQuestion.comments[updatedQuestion.comments.length - 1];

        res.status(201).json({ message: 'Comment added successfully', question: updatedQuestion });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add comment', error });
    }
};

module.exports = { addQuestion,  addComment };
