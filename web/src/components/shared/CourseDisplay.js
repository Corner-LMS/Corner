import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getCurrentRole } from '../../utils/auth';
import CourseForm from '../course/CourseForm';
import { fetchUserInfo } from '../../utils/userInfo';
const CourseDisplay = ({ viewType = 'all' }) => {
    const [courses, setCourses] = useState([]);
    const [message, setMessage] = useState('');
    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [teacherNames, setTeacherNames] = useState({});
    const [role, setRole] = useState(null);
    const [isStudent, setIsStudent] = useState(false);
    const navigate = useNavigate();
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';

    // Move role check to useEffect to handle updates
    useEffect(() => {
        const checkRole = () => {
            const currentRole = getCurrentRole();
            const studentToken = localStorage.getItem('studentToken');
            const teacherToken = localStorage.getItem('teacherToken');
            
            setRole(currentRole);
            // Convert to proper boolean using double negation
            setIsStudent(!!(currentRole === 'student' && studentToken));
            
            // If no valid tokens exist, redirect to login
            if (!studentToken && !teacherToken) {
                navigate('/login');
            }
        };

        checkRole();
    }, [navigate]);

    // Update token usage to be role-specific
    const getAuthToken = useCallback(() => {
        return localStorage.getItem(`${role}Token`);
    }, [role]);

    const fetchCourses = useCallback(async () => {
        const token = getAuthToken();
        if (!token || !role) return;

        try {
            let coursesData;
            
            if (isStudent) {
                // Fetch all courses and enrolled courses for students
                const [allCoursesRes, enrolledCoursesRes] = await Promise.all([
                    axios.get(`${url}/corner/course/get-all-courses`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    axios.get(`${url}/corner/course/get-student-courses`, {
                        headers: { Authorization: `Bearer ${token}` },
                    })
                ]);
                
                if (viewType === 'all') {
                    const enrolledIds = new Set(enrolledCoursesRes.data.courses.map(c => c._id));
                    coursesData = allCoursesRes.data.courses.filter(course => !enrolledIds.has(course._id));
                } else {
                    coursesData = enrolledCoursesRes.data.courses || [];
                }
                setEnrolledCourses(enrolledCoursesRes.data.courses || []);
            } else {
                const response = await axios.get(
                    `${url}/corner/course/get-teacher-courses`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                coursesData = response.data.courses;
            }

            const sortedCourses = coursesData
                .filter((course) => !isNaN(new Date(course.createdAt).getTime()))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setCourses(sortedCourses);
        } catch (error) {
            if (error.response?.status === 401) {
                // Handle unauthorized error
                navigate('/login');
            }
            setMessage('Failed to load courses. ' + error.message);
        }
    }, [isStudent, role, getAuthToken, viewType, navigate, url]);

    useEffect(() => {
        if (role) {
            fetchCourses();
        }
    }, [fetchCourses, role]);

    const handleEnrollment = async (courseId) => {
        try {
            await axios.post(
                `${url}/corner/course/enroll-in-courses`,
                { courses: [courseId] },
                { headers: { Authorization: `Bearer ${getAuthToken()}` } }
            );
            setMessage('Successfully enrolled in the course!');
            // Redirect to dashboard after enrollment
            if (viewType === 'all') {
                navigate('/student-dashboard');
            } else {
                fetchCourses();
            }
        } catch (error) {
            setMessage('Failed to enroll in the course: ' + error.message);
        }
    };

    const handleCourseAdded = () => {
        setIsModalOpen(false);
        fetchCourses();
    };

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    useEffect(() => {
        // Fetch teacher names for all courses
        const fetchTeacherNames = async () => {
            const names = {};
            for (const course of courses) {
                if (course.teacherId && !teacherNames[course.teacherId]) {
                    const teacherInfo = await fetchUserInfo(course.teacherId);
                    if (teacherInfo) {
                        names[course.teacherId] = teacherInfo.name;
                    }
                }
            }
            setTeacherNames(prev => ({ ...prev, ...names }));
        };

        if (courses.length > 0) {
            fetchTeacherNames();
        }
    }, [courses]);

    const getUserId = () => {
        const user = JSON.parse(localStorage.getItem(`${role}Data`));
        return user?._id;
    };

    return (
        <div className="max-w-7xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800">
                    {isStudent ? 
                        (viewType === 'all' ? 'Available Courses' : 'My Enrolled Courses') :
                        'My Courses'}
                </h2>
                {(!isStudent && role === 'teacher') && (
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-rose-700 hover:bg-rose-600 text-white px-6 py-2 rounded-lg 
                                 transition-colors duration-200 flex items-center gap-2"
                    >
                        <span>+ Create New Course</span>
                    </button>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">Create New Course</h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        <CourseForm onCourseAdded={handleCourseAdded}
                            getAuthToken={getAuthToken}
                            role={role} />
                    </div>
                </div>
            )}

            {message && (
                <div className="mb-6 p-4 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                    <div 
                        key={course._id} 
                        className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow 
                                 duration-300 overflow-hidden border border-gray-100"
                    >
                        <div className="p-6">
                            <div className="mb-4">
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                    {course.name}
                                </h3>
                                <p className="text-sm text-gray-600">
                                    By: {teacherNames[course.teacherId] || 'Unknown Teacher'}
                                </p>
                            </div>
                            
                            <p className="text-gray-600 mb-6 line-clamp-3">
                                {course.description || 'No description available'}
                            </p>

                            <div className="flex justify-end">
                                {isStudent ? (
                                    viewType === 'all' ? (
                                        <button
                                            onClick={() => handleEnrollment(course._id)}
                                            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 
                         rounded-lg transition-colors duration-200"
                                        >
                                            Enroll Now
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => navigate(`/courses/${course._id}`)}
                                            className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 
                         rounded-lg transition-colors duration-200"
                                        >
                                            View Course
                                        </button>
                                    )
                                ) : (
                                    <button 
                                        onClick={() => navigate(`/courses/${course._id}`)}
                                        className="bg-rose-900 hover:bg-rose-600 text-white px-6 py-2 
                                                 rounded-lg transition-colors duration-200"
                                    >
                                        Manage Course
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {courses.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-600 text-lg">
                        {isStudent ? 'No courses available.' : "You haven't created any courses yet."}
                    </p>
                </div>
            )}
        </div>
    );
};

export default CourseDisplay; 