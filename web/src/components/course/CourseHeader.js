import React, { useState } from 'react';
import { FaTrash, FaEdit, FaEllipsisV } from 'react-icons/fa';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CourseHeader = ({ course, setCourse }) => {
    const [showEditModal, setShowEditModal] = useState(false);
    const [newTitle, setNewTitle] = useState(course?.name || '');
    const [showDropdown, setShowDropdown] = useState(false);
    const navigate = useNavigate();
    const token = localStorage.getItem('teacherToken');
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';


    const handleEditCourse = async () => {
        try {
            const response = await axios.put(
                `${url}/corner/course/${course._id}/update`,
                { name: newTitle },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setCourse({ ...course, name: newTitle });
            setShowEditModal(false);
        } catch (error) {
            console.error('Error editing course:', error);
        }
    };

    const handleDeleteCourse = async () => {
        if (window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
            try {
                await axios.delete(
                    `${url}/corner/course/${course._id}/delete`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                navigate('/teacher-dashboard'); // Redirect to dashboard after deletion
            } catch (error) {
                console.error('Error deleting course:', error);
            }
        }
    };

    return (
        <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="px-6 py-4 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">{course?.name}</h1>
                <div className="relative">
                    <button 
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <FaEllipsisV />
                    </button>
                    {showDropdown && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                            <button
                                onClick={() => {
                                    setNewTitle(course.name);
                                    setShowEditModal(true);
                                    setShowDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-gray-700"
                            >
                                <FaEdit className="mr-2" /> Edit Course
                            </button>
                            <button
                                onClick={() => {
                                    handleDeleteCourse();
                                    setShowDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-red-600"
                            >
                                <FaTrash className="mr-2" /> Delete Course
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Course Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <h3 className="text-lg font-medium mb-4">Edit Course</h3>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                            placeholder="Course title"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditCourse}
                                className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseHeader;