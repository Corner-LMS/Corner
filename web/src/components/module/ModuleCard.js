import { useState } from 'react';
import ModuleItemList from './ModuleItemList';
import AddContentForm from './AddModuleContentForm';
import axios from 'axios';

export default function ModuleCard({ module, teacherId, onUpdate }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showAddContent, setShowAddContent] = useState(false);
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';

    const togglePublish = async () => {
        try {
            await axios.put(`${url}/corner/modules/${module._id}`, {
                isPublished: !module.isPublished
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });
            onUpdate();
        } catch (err) {
            console.error('Failed to update module', err);
        }
    };

    return (
        <div className="bg-gray-200 rounded-md border border-gray-300 shadow-sm mb-4">
            <div
                className="flex justify-between items-center p-6 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-2">
                    <svg
                        className={`w-8 h-8 transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path d="M6 8l4 4 4-4" />
                    </svg>
                    <h3 className="font-medium text-lg text-gray-800">{module.title}</h3>
                    {module.isPublished && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Published
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-x-3">
                    {module.teacherId && teacherId === module.teacherId && (
                        <>
                            <button
                                onClick={() => setShowAddContent(!showAddContent)}
                                className="text-sm font-bold text-rose-700 hover:text-rose-800"
                            >
                                {showAddContent ? 'Cancel' : '+ Content'}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    togglePublish();
                                }}
                                className={`text-sm px-2 py-1 rounded ${module.isPublished
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-rose-100 text-rose-800'
                                    }`}
                            >
                                {module.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="border-t border-gray-200 bg-white rounded-b-md">
                    {showAddContent && teacherId === module.teacherId && (
                        <AddContentForm
                            moduleId={module._id}
                            onSuccess={() => {
                                setShowAddContent(false);
                                onUpdate();
                            }}
                        />
                    )}
                    <ModuleItemList
                        moduleId={module._id}
                        teacherId={teacherId}
                    />
                </div>
            )}
        </div>
    );
}
