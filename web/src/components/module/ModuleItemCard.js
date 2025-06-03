// ModuleItemCard.js
import React, { useState } from 'react';
import axios from 'axios';
import { FaEdit, FaTrash, FaFileAlt, FaLink, FaFile, FaPlus } from 'react-icons/fa';
import FileUploadForm from './FileUploadForm';

const ModuleItemCard = ({ moduleId, items = [], onItemsUpdate }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItem, setNewItem] = useState({
        title: '',
        type: 'text',
        content: { text: '' }
    });
    const [isLoading, setIsLoading] = useState(false);
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');
    const isTeacher = !!localStorage.getItem('teacherToken');
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';

    const handleDelete = async (itemId) => {
        try {
            await axios.delete(`${url}/corner/module-items/${itemId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Remove the deleted item from the list
            const updatedItems = items.filter(item => item._id !== itemId);
            onItemsUpdate(updatedItems);
        } catch (err) {
            console.error('Failed to delete item', err);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await axios.post(
                `${url}/corner/module-items/`,
                {
                    moduleId,
                    title: newItem.title,
                    type: newItem.type,
                    content: newItem.content
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.status === 201) {
                onItemsUpdate([...items, response.data]);
                setNewItem({
                    title: '',
                    type: 'text',
                    content: { text: '' }
                });
                setShowAddForm(false);
            }
        } catch (err) {
            console.error('Failed to add module item:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const togglePublish = async (itemId, currentStatus) => {
        try {
            await axios.put(
                `${url}/corner/module-items/${itemId}`,
                { isPublished: !currentStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Update the item in the list
            const updatedItems = items.map(item => 
                item._id === itemId ? { ...item, isPublished: !item.isPublished } : item
            );
            onItemsUpdate(updatedItems);
        } catch (err) {
            console.error('Failed to update item', err);
        }
    };

    const handleFileUploadSuccess = (newFileItem) => {
        onItemsUpdate([...items, newFileItem]);
        setShowAddForm(false);
        setNewItem({
            title: '',
            type: 'text',
            content: { text: '' }
        });
    };

    const renderItemContent = (item) => {
        if (!item) return null;

        return (
            <div>
                <h4 className="font-medium text-gray-900">{item.title || 'Untitled'}</h4>
                
                {/* Text content */}
                {item.type === 'text' && item.content?.text && (
                    <p className="text-sm text-gray-600 mt-1">{item.content.text}</p>
                )}

                {/* Link content */}
                {item.type === 'link' && item.content?.url && (
                    <a 
                        href={item.content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-1 block"
                    >
                        {item.content.url}
                    </a>
                )}

                {/* Document content - Updated condition */}
                {item.type === 'document' && (item.file?.path || item.path) && (
                    <a 
                        href={item.file?.path || ''}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-1 block"
                    >
                        View Document
                    </a>
                )}

            
            </div>
        );
    };

    return (
        <div className="space-y-4">
            

            {/* Existing Items */}
            {items && Array.isArray(items) && items.length > 0 ? (
                <div className="space-y-2">
                    {items.map((item) => {
                       
                        if (!item) return null; 
                        return (
                        <div key={item._id || Math.random()} className="bg-white p-4 rounded-md shadow-sm border border-gray-200">
                            <div className="flex justify-between items-start">
                                {renderItemContent(item)}
                                <div className="flex space-x-2">
                                    {item._id && isTeacher && (
                                        <>
                                            <button
                                                onClick={() => togglePublish(item._id, item.isPublished)}
                                                className={`text-sm px-2 py-1 rounded ${
                                                    item.isPublished 
                                                        ? 'bg-green-100 text-green-700' 
                                                        : 'bg-gray-100 text-gray-700'
                                                }`}
                                            >
                                                {item.isPublished ? 'Published' : 'Draft'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item._id)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <FaTrash />
                                            </button>
                                        </>
                                    )}
                                </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-gray-500 italic">No items in this module</p>
            )}
            {/* Only show Add Item button and form for teachers */}
            {isTeacher && (
                <>
                    {/* Header with Add Item Button */}
                    <div className="flex justify-end mb-2">
                        {!showAddForm && (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="flex items-center text-rose-600 hover:text-rose-700 transition-colors border-2 border-rose-600 rounded-sm px-3 py-1"
                            >
                                <FaPlus className="mr-2" /> Add Module Item
                            </button>
                        )}
                    </div>

                    {/* Add Item Form */}
                    {showAddForm && (
                        <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-4">Add New Item</h4>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Type
                                </label>
                                <select
                                    value={newItem.type}
                                    onChange={(e) => setNewItem({ 
                                        ...newItem, 
                                        type: e.target.value,
                                        content: e.target.value === 'text' ? { text: '' } : {}
                                    })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                                >
                                    <option value="text">Text</option>
                                    <option value="document">Document/File</option>
                                    <option value="link">Link</option>
                                </select>
                            </div>

                            {newItem.type === 'document' ? (
                                <FileUploadForm 
                                    moduleId={moduleId}
                                    type="document"
                                    onSuccess={handleFileUploadSuccess}
                                />
                            ) : (
                                <form onSubmit={handleAddItem} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            value={newItem.title}
                                            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                                            required
                                        />
                                    </div>

                                    {newItem.type === 'text' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Content
                                            </label>
                                            <textarea
                                                value={newItem.content.text}
                                                onChange={(e) => setNewItem({
                                                    ...newItem,
                                                    content: { text: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                                                rows="3"
                                                required
                                            />
                                        </div>
                                    )}

                                    {newItem.type === 'link' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                URL
                                            </label>
                                            <input
                                                type="url"
                                                value={newItem.content.url || ''}
                                                onChange={(e) => setNewItem({
                                                    ...newItem,
                                                    content: { url: e.target.value }
                                                })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddForm(false)}
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50"
                                        >
                                            {isLoading ? 'Adding...' : 'Add Item'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ModuleItemCard;