import React from 'react';
import { useLocation } from 'react-router-dom';
import TeacherLayout from '../layouts/TeacherLayout';
import CourseDisplay from '../components/shared/CourseDisplay';

const StudentCourseSelection = () => {
    const location = useLocation();
    const isCoursesPage = location.pathname === '/teacher-courses';

    return (
        <TeacherLayout>
            <CourseDisplay 
                role="student" 
                viewType={isCoursesPage ? 'all' : 'enrolled'} 
            />
        </TeacherLayout>
    );
};

export default StudentCourseSelection;
