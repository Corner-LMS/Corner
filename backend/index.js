const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const createQuestionRoutes = require('./routes/questionRoutes');
const userRoutes = require('./routes/userRoutes');
// const schoolRoutes = require('./routes/schoolRoutes');
const adminRoutes = require('./routes/adminRoutes');
const moduleRoutes = require('./routes/moduleRoutes');
const moduleItemRoutes = require('./routes/moduleItemRoutes');
const courseAiRoutes = require('./routes/courseAiRoutes');
// Initialize app and server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const allowedOrigins = [process.env.FRONTEND_URL, process.env.DEV_FRONTEND_URL, 'http://localhost:3000']
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.send('Backend is running');
});


app.use('/corner/auth', authRoutes);
app.use('/corner/course', courseRoutes);
app.use('/corner/course', createQuestionRoutes(io)); // Pass io to routes
app.use('/corner/user', userRoutes);
// app.use('/corner/schoolregister', schoolRoutes);
app.use('/corner/admin', adminRoutes);
app.use('/corner/modules', moduleRoutes);
app.use('/corner/module-items', moduleItemRoutes);
app.use('/corner/ai', courseAiRoutes);
// Serve static files
app.use(express.static(path.join(__dirname,'build')));

// Serve the index.html file for all routes that are not API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname,'build', 'index.html'));
});

// Database Connection
connectDB(); // Ensure the database is connected before starting the server

// Socket.IO Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Joining a course-specific room
    socket.on('joinCourseRoom', (courseId) => {
        socket.join(courseId);
        console.log(`User joined course room: ${courseId}`);
    });

    // Broadcast new questions
    socket.on('questionAdded', (question) => {
        io.to(question.courseId).emit('newQuestion', question);
        console.log('New question broadcasted:', question);
    });

    // Broadcast new comments
    socket.on('commentAdded', ({ questionId, updatedComments }) => {
        io.to(questionId).emit('newComment', { questionId, updatedComments });
        console.log(`New comment broadcasted for question: ${questionId}`);
    });

    // Broadcast new announcements
    socket.on('announcementAdded', (announcement) => {
        io.to(announcement.courseId).emit('newAnnouncement', announcement);
        console.log('New announcement broadcasted:', announcement);
    });

    // Leaving the room
    socket.on('leaveCourseRoom', (courseId) => {
        socket.leave(courseId);
        console.log(`User left course room: ${courseId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
