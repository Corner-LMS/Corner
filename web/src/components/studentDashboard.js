import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CourseDisplay from './shared/CourseDisplay';
import TeacherLayout from '../layouts/TeacherLayout';
const StudentDashboard = () => {
    return (
        <TeacherLayout>
            <CourseDisplay role="student" />
        </TeacherLayout>
    );
};

export default StudentDashboard;
