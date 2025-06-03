// LinkForm.js
import { useState } from 'react';
import axios from 'axios';

export default function LinkForm({ moduleId, onSuccess }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001'}/corner/module-items/`, {
                moduleId,
                title,
                type: 'link',
                content: {url: content}
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('teacherToken')}`
                },
            });

            if (res.status === 201) {
                onSuccess();
                setTitle('');
                setContent('');
            }
        } catch (err) {
            console.error('Failed to add link', err);
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
            <a href={content} target="_blank" rel="noopener noreferrer">
                {content}
            </a>
            <input
                type="url"
                placeholder="https://example.com"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-2 border rounded"
                required
            />
            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-400"
                >
                    {isLoading ? 'Saving...' : 'Save Link'}
                </button>
            </div>
        </form>
    );
}