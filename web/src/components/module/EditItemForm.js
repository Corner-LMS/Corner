// EditItemForm.js
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function EditItemForm({ item, onSuccess, onCancel }) {
    const [title, setTitle] = useState(item.title);
    const [content, setContent] = useState(item.content?.text || '');
    const [isLoading, setIsLoading] = useState(false);
    const URL = process.env.NEXT_PUBLIC_BASE_URL||'http://localhost:5001';

    useEffect(() => {
        setTitle(item.title);
        setContent(item.content?.text || '');
    }, [item]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await axios.put(`${URL}/corner/module-items/${item._id}`, {
                title,
                type: item.type,
                ...(item.type === 'text' && { content: { text: content } })
                
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('teacherToken')}`
                },
                
            });

            if (res.status === 200) {
                onSuccess();
            }
        } catch (err) {
            console.error('Failed to update item', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 border rounded"
                required
            />

            {item.type === 'text' && (
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-2 border rounded min-h-[150px]"
                    required
                />
            )}

            <div className="flex justify-end space-x-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border rounded"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-400"
                >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
}