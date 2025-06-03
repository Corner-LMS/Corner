// src/pages/TeacherDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CourseCard from '../components/course/CourseCard';
import AccountModal from '../utils/accountModal';
import TeacherLayout from '../layouts/TeacherLayout';
import '../styles/teacherdash.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import CourseDisplay from '../components/shared/CourseDisplay';
const TeacherDashboard = () => {
    const navigate = useNavigate();
    const [isTeacher, setIsTeacher] = useState(false);
    const [courses, setCourses] = useState([]);
    const [courseName, setCourseName] = useState('');
    const [courseDescription, setCourseDescription] = useState('');
    const [message, setMessage] = useState('');
    const [accountModalVisible, setAccountModalVisible] = useState(false);
    const [user, setUser] = useState({});
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');

    const getTeacherId = () => {
        const token = localStorage.getItem('teacherToken');
        if (token) {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            return decodedToken.userId;
        }
        return null;
    };

    const fetchCourses = useCallback(async () => {
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001'}/corner/course/get-teacher-courses`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setCourses(response.data.courses);
        } catch (error) {
            setMessage(error.response?.data?.msg || 'Failed to load courses.' + error.message);
        }
    }, [token]);

    

    const checkIsTeacher = useCallback(() => {
        const teacherToken = localStorage.getItem('teacherToken');
        if (!teacherToken) {
            navigate('/');
            return;
        }
        setIsTeacher(true);
    }, [navigate]);

    useEffect(() => {
        checkIsTeacher();
        fetchCourses();
        // fetchUserInfo();
    }, [fetchCourses, checkIsTeacher]);

    

    return (
        <TeacherLayout>
            <CourseDisplay role="teacher" />
            
        </TeacherLayout>
    );
};

export default TeacherDashboard;
