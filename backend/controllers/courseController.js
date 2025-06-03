const Course = require('../models/course');
const User = require('../models/user');
const Question = require('../models/question');
const Announcement = require('../models/announcement');

const addCourse = async (req, res) => {

    const user = req.user;
    const teacherId = user.userId;
    const { name, description } = req.body;
    try {
        
        const course = new Course({ name, teacherId, description });
        await course.save();
        res.status(201).json({ message: 'Course added successfully', course });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add course'+error.message });
    }
};

const getCoursesByTeacherId = async (req, res) => {
    try {
        const { teacherId } = req;
        
        // Logic to fetch courses based on teacherId
        const courses = await Course.find({ teacherId });  // Replace with your actual model and query
        if (!courses) {
            return res.status(404).json({ msg: 'Courses not found' });
        }
        res.json({ courses });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses'+error.message });
    }
};

const enrollInCourse = async (req, res) => {
    const {  courses } = req.body;
    try {
        const user = req.user
        const studentId = user.userId
        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ msg: 'Student not found' });

        // Add new courses and avoid duplicates
        const updatedCourses = [...new Set([...student.courses, ...courses])];

        // Update student's courses
        await User.findByIdAndUpdate(studentId, { courses: updatedCourses });

        res.status(200).json({
            message: 'Courses enrolled successfully',
            courses: updatedCourses
        });
    } catch (error) {
        console.log('Error in enrollInCourse:', error.message, error.stack);
        res.status(500).json({ msg: 'Failed to select courses', error: error.message });
    }
};

const getCourseById = async (req, res) => {
    try {
        const { courseId } = req.params;
        const user = req.user;
        const userId = user.userId;

        // Fetch the course ensuring it matches the schoolCode
        const course = await Course.findOne({ _id: courseId }).populate('teacherId');
        if (!course) {
            return res.status(404).json({ msg: 'Course not found or you do not have access to it' });
        }

        // If user is a teacher, verify they own the course
        // If user is a student, verify they are enrolled in the course
        if (user.role === 'teacher' && String(course.teacherId._id) !== String(userId)) {
            return res.status(403).json({ msg: 'You do not have access to this course' });
        }

        const questions = await Question.find({ courseId: courseId })
            .populate('createdBy')
            .populate({
                path: 'comments.author',
                select: 'name role'
            })
            .sort({ createdAt: -1 });

        const sortedQuestions = await Promise.all(
            questions.map(async (question) => {
                question.comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                return question;
            })
        );
        
        res.status(200).json({ course, questions: sortedQuestions });
    } catch (error) {
        res.status(500).json({ msg: 'Failed to fetch course and questions', error: error.message });
    }
};
const getAllCourses = async (req, res) => {
    try {
        const user = req.user; // Extract user info set by middleware
        console.log("user", user);
        if (!user) {
            return res.status(403).json({ msg: 'User not authenticated' });
        }

        let courses;

        if (user.role === 'student') {
            const student = await User.findById(user.userId).populate('school');
            console.log('Student info:', student);

            if (!student) {
                return res.status(404).json({ msg: 'Student not found' });
            }

            if (!student.school) {
                return res.status(404).json({ msg: 'Student does not have an associated school' });
            }

            // Students see courses created by teachers from their school
            courses = await Course.find().populate({
                path: 'teacherId',
                match: { school: student.school._id }, // Match teachers from the same school
            });

            // Filter out courses with mismatched schools
            courses = courses.filter((course) => course.teacherId !== null);
        } else if (user.role === 'teacher') {
            // Teachers see only courses they created
            courses = await Course.find({ teacherId: user._id }).populate('teacherId');
        } else if (user.role === 'admin') {
            // Admins see all courses
            courses = await Course.find().populate('teacherId');
        } else {
            return res.status(403).json({ msg: 'Access denied' });
        }

        res.status(200).json({ courses });
    } catch (error) {
        console.error('Error fetching courses:', error.message);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
};

const getStudentCourses = async (req, res) => {
    try {
        const user = req.user; // Extract user ID from the decoded token in auth middleware
        const student = await User.findById(user.userId);

        if (!student) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Ensure user is a student
        if (student.role !== 'student') {
            return res.status(403).json({ message: 'Access forbidden: Only students can access this endpoint' });
        }

        // Find all instructors in the same school
        const instructors = await User.find({ school: student.school, role: 'teacher' });

        // Extract instructor IDs
        const instructorIds = instructors.map((instructor) => instructor._id);

        // Find all courses associated with these instructors
        const courses = await Course.find({ teacherId: { $in: instructorIds } });

        res.status(200).json({ courses });
    } catch (error) {
        console.error('Error fetching student courses:', error);
        res.status(500).json({ message: 'Failed to fetch courses', error: error.message });
    }
};

const getTeacherCourses = async (req, res) => {
    try {
        const user = req.user; // Extract user ID from the decoded token in auth middleware

        // Find the teacher
        const teacher = await User.findById(user.userId);

        if (!teacher) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Ensure the user is an instructor
        if (teacher.role !== 'teacher') {
            return res.status(403).json({ message: 'Access forbidden: Only teachers can access this endpoint' });
        }

        // Fetch all courses where the teacher is the instructor
        const courses = await Course.find({ teacherId: user.userId });

        res.status(200).json({ courses });
    } catch (error) {
        console.error('Error fetching teacher courses:', error);
        res.status(500).json({ message: 'Failed to fetch courses', error: error.message });
    }
};

const addAnnouncement = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { title, content } = req.body;
        const user = req.user;
        const userId = user.userId;

        // Check if course exists
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Create new announcement
        const announcement = new Announcement({
            course: courseId,
            title,
            content,
            createdBy: userId,
            createdAt: new Date(),
        });

        await announcement.save();
        res.status(201).json({ message: 'Announcement added', announcement });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAnnouncements = async (req, res) => {
    try {
        const { courseId } = req.params;

        // Check if course exists
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Fetch announcements sorted by createdAt (recent first)
        const announcements = await Announcement.find({ course: courseId }).sort({ createdAt: -1 });

        res.json({ announcements });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getCourseQuestions = async (req, res) => {
    try {
        const { courseId } = req.params;
        
        // Find all questions for this course and populate the creator and comments
        const questions = await Question.find({ courseId })
            .populate('createdBy', 'name role')
            .populate('comments.author', 'name role')
            .sort({ createdAt: -1 }); // Sort by newest first

        res.status(200).json({
            success: true,
            questions
        });
    } catch (error) {
        console.error('Error fetching course questions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch course questions',
            error: error.message
        });

    }
};

const updateCourse = async (req, res) => {
    const { courseId } = req.params;
    const { name } = req.body;
    await Course.findByIdAndUpdate(courseId, { name });
};
const deleteCourse = async (req, res) => {
    const { courseId } = req.params;
    await Course.findByIdAndDelete(courseId);
    res.status(200).json({ message: 'Course deleted successfully' });
};

module.exports = { addCourse, getCoursesByTeacherId, getAllCourses, enrollInCourse,  getCourseById, getStudentCourses, getTeacherCourses, addAnnouncement, getAnnouncements, getCourseQuestions, updateCourse, deleteCourse };