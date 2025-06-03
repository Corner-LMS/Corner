// ModuleList.js
import React, { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaEllipsisV, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import ModuleCard from './ModuleCard';
import AddModuleForm from './AddModuleForm';
import axios from 'axios';
import ModuleItemList from './ModuleItemList';

export default function ModuleList({ courseId, teacherId }) {
    const [modules, setModules] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingModule, setEditingModule] = useState(null);
    const [newTitle, setNewTitle] = useState('');
    const [showDropdown, setShowDropdown] = useState(null);
    const [expandedModule, setExpandedModule] = useState(null);
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');
    const isTeacher = !!localStorage.getItem('teacherToken');
    

    const fetchModules = async () => {
        try {
            const res = await axios.get(`${url}/corner/modules/${courseId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = res.data;
            setModules(data);
        } catch (err) {
            console.error('Failed to fetch modules', err)
        }
    }

    // Call this on component mount
    useEffect(() => {
        fetchModules();
    }, [courseId]);

    const toggleModule = (moduleId, e) => {
        e.stopPropagation(); // Prevent triggering dropdown
        setExpandedModule(expandedModule === moduleId ? null : moduleId);
    };

    const handleEditModule = async (moduleId) => {
        try {
            const response = await axios.put(
                `${url}/corner/modules/${moduleId}`,
                { title: newTitle },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Update the modules list with the edited module
            setModules(modules.map(module => 
                module._id === moduleId ? { ...module, title: newTitle } : module
            ));
            
            setShowEditModal(false);
            setEditingModule(null);
            setNewTitle('');
        } catch (error) {
            console.error('Error editing module:', error);
        }
    };

    const handleDeleteModule = async (moduleId) => {
        if (window.confirm('Are you sure you want to delete this module?')) {
            try {
                await axios.delete(
                    `${url}/corner/modules/${moduleId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                
                // Remove the deleted module from the list
                setModules(modules.filter(module => module._id !== moduleId));
            } catch (error) {
                console.error('Error deleting module:', error);
            }
        }
    };

    const handleAddModule = async () => {
        try {
            const response = await axios.post(
                `${url}/corner/modules`,
                {
                    title: newTitle,
                    courseId: courseId,
                    description: '' // Optional description
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setModules([...modules, response.data]);
            setShowAddForm(false);
            setNewTitle('');
        } catch (error) {
            console.error('Error adding module:', error);
        }
    };

    const handleItemsUpdate = (moduleId, updatedItems) => {
        setModules(modules.map(module => 
            module._id === moduleId 
                ? { ...module, items: updatedItems }
                : module
        ));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Course Modules</h2>
                {isTeacher && (
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                    >
                        {showAddForm ? 'Cancel' : '+ Add Module'}
                    </button>
                )}
            </div>

            {showAddForm && (
                <AddModuleForm
                    courseId={courseId}
                    teacherId={teacherId}
                    onSuccess={() => {
                        setShowAddForm(false);
                        fetchModules();
                    }}
                />
            )}

            <div className="space-y-4">
                {modules.map((module) => (
                    <div key={module._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div 
                            className="p-4 cursor-pointer hover:bg-gray-50"
                            onClick={(e) => toggleModule(module._id, e)}
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                    {expandedModule === module._id ? 
                                        <FaChevronUp className="text-gray-400" /> : 
                                        <FaChevronDown className="text-gray-400" />
                                    }
                                    <h3 className="text-lg font-medium">{module.title}</h3>
                                </div>
                                {isTeacher && (
                                    <div className="relative">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowDropdown(showDropdown === module._id ? null : module._id);
                                            }}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            <FaEllipsisV />
                                        </button>
                                        {showDropdown === module._id && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingModule(module);
                                                        setNewTitle(module.title);
                                                        setShowEditModal(true);
                                                        setShowDropdown(null);
                                                    }}
                                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-gray-700"
                                                >
                                                    <FaEdit className="mr-2" /> Edit
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteModule(module._id);
                                                        setShowDropdown(null);
                                                    }}
                                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center text-red-600"
                                                >
                                                    <FaTrash className="mr-2" /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {expandedModule === module._id && (
                            <div className="border-t border-gray-200 p-4 bg-gray-50">
                                <ModuleItemList 
                                    moduleId={module._id}
                                    teacherId={teacherId}
                                    isTeacher={isTeacher}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Edit Module Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <h3 className="text-lg font-medium mb-4">Edit Module</h3>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                            placeholder="Module title"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingModule(null);
                                }}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleEditModule(editingModule._id)}
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
}