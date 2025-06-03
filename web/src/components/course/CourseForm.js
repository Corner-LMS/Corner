// components/CourseForm.js
import React, { useState } from 'react';
import axios from 'axios';

const CourseForm = ({ onCourseAdded, getAuthToken, role }) => {
    console.log('[CourseForm] Rendering with role:', role); // Add this
    const [courseName, setCourseName] = useState('');
    const [courseDescription, setCourseDescription] = useState('');
    const [message, setMessage] = useState('');
    const token = getAuthToken();

    
    // Function to get teacher ID from JWT in localStorage
    const getTeacherId = () => {
        if (token) {
            try {
                const decodedToken = JSON.parse(atob(token.split('.')[1])); // Decode JWT token
                
                return decodedToken.userId; // Assuming the teacher's ID is stored in the '_id' field
            } catch (error) {
                console.error('Error decoding token:', error);
                return null;
            }
        }
        return null;
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        const teacherId = getTeacherId();
        
        if (!teacherId) {
            setMessage('Teacher ID not found. Please log in again.');
            return;
        }
        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001'}/corner/course/add-course`, {
                name: courseName,
                description: courseDescription,
                teacherId: teacherId,
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setMessage(response.data.message || 'Course added successfully');
            setCourseName('');
            setCourseDescription('');
            if (onCourseAdded) onCourseAdded();
        } catch (error) {
            console.log("error", error);
            setMessage('Failed to add course. Please try again.');
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <input
                        type="text"
                        placeholder="Course Name"
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-700"
                        required
                    />
                </div>
                <div>
                    <textarea
                        placeholder="Course Description"
                        value={courseDescription}
                        onChange={(e) => setCourseDescription(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-700"
                        rows="4"
                        required
                    />
                </div>
                <button 
                    type="submit"
                    className="w-full bg-rose-700 hover:bg-rose-600 text-white px-6 py-2 rounded-lg transition-colors duration-200"
                >
                    Create Course
                </button>
            </form>
            {message && (
                <p className="mt-4 text-center text-sm font-medium text-gray-600">
                    {message}
                </p>
            )}
        </div>
    );
};

export default CourseForm;
