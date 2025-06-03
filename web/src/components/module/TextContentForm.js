// TextContentForm.js
import { useState } from 'react';
import axios from 'axios';

export default function TextContentForm({ moduleId, onSuccess }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await axios.post(`${url}/corner/module-items/`, {
                moduleId,
                title,
                type: 'text',
                content: {text: content}
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('teacherToken')}`
                }
            });

            if (res.status === 201) {
                onSuccess();
                setTitle('');
                setContent('');
            }
        } catch (err) {
            console.error('Failed to add text content', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 mt-3">
            <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 border rounded"
                required
            />
            <textarea
                placeholder="Enter your content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-2 border rounded min-h-[150px]"
                required
            />
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-400"
                >
                    {isLoading ? 'Saving...' : 'Save Content'}
                </button>
            </div>
        </form>
    );
}