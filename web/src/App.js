import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Signup from './components/signup';
import Login from './components/login';
import TeacherDashboard from './teacher/teacherDashboard';
import StudentCourseSelection from './student/studentCourseSelection';
import StudentDashboard from './components/studentDashboard';
import CourseDetails from './components/course/CourseDetails';
import Home from './components/home';
import useAutoLogout from './hooks/autoLogout';
import LogoutButton from './components/logoutButton';
// import RegisterSchool from './components/registerSchool';
import VerifyEmail from './components/verifyEmail';
import TeacherLayout from './layouts/TeacherLayout';
import CourseDisplay from './components/shared/CourseDisplay';
import WorkInProgress from './components/WorkInProgress';


function App() {
    useAutoLogout();
    const [role, setRole] = useState('');
    const [user, setUser] = useState(null); // Store the logged-in user data
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const teacherToken = localStorage.getItem('teacherToken');
        const studentToken = localStorage.getItem('studentToken');

        if (teacherToken) {
            const decodedToken = JSON.parse(atob(teacherToken.split('.')[1]));
            setRole(decodedToken.role);
            setUser(decodedToken); // Save the decoded user data
        } else if (studentToken) {
            const decodedToken = JSON.parse(atob(studentToken.split('.')[1]));
            setRole(decodedToken.role);
            setUser(decodedToken);
        }

        setLoading(false); // Set loading to false after the role and user are set
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <Router>
            <Routes>
                <Route exact path="/" element={<Home />} />
                <Route exact path="/signup" element={<Signup />} />
                <Route exact path="/login" element={<Login />} />
                <Route exact path="/verify-email/:token" element={<VerifyEmail />} />
                <Route exact path="/logout" element={<LogoutButton />} />
                <Route exact path="/work-in-progress" element={<WorkInProgress />} />
                <Route exact path="/add-course" element={<TeacherDashboard />} />
                <Route exact path="/select-course" element={<StudentCourseSelection />} />
                <Route exact path="/teacher-courses" element={
                    role === 'teacher' ? (
                        <TeacherLayout>
                            <CourseDisplay viewType="teacher" />
                        </TeacherLayout>
                    ) : <Login />
                } />

                <Route exact path="/student-dashboard" element={
                    role === 'student' ? (
                        <TeacherLayout>
                            <CourseDisplay viewType="enrolled" />
                        </TeacherLayout>
                    ) : <Login />
                } />
                {/* <Route exact path="/register-school" element={<RegisterSchool />} /> */}
                {/* <Route path="/student-dashboard"
                    element={role === 'student' ? <StudentDashboard /> : <Login />}
                /> */}
                <Route path="/teacher-dashboard"
                    element={role === 'teacher' ? <TeacherDashboard /> : <Login />}
                />
                <Route path="/courses/:courseId" element={<CourseDetails />} /> {/* Course Details */}
                

            </Routes>
        </Router>
    );
}

export default App;
