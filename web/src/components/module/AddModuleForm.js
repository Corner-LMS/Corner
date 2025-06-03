// AddModuleForm.js
import { useState } from 'react';
import axios from 'axios';
export default function AddModuleForm({ courseId, onSuccess, teacherId }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await axios.post(`${url}/corner/modules/`, {
                title,
                description,
                courseId,
                teacherId
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('teacherToken')}`
                }
            });

            if (res.status === 200) {
                onSuccess();
                setTitle('');
                setDescription('');
            }
        } catch (err) {
            console.error('Failed to create module', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="space-y-3 gap-2">
                <input
                    type="text"
                    placeholder="Module Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-rose-700"
                    required
                />
                
                <div className="flex justify-end space-x-2 mt-4">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-2 bg-rose-600 text-white rounded disabled:bg-rose-400"
                    >
                        {isLoading ? 'Creating...' : 'Create Module'}
                    </button>
                </div>
            </div>
        </form>
    );
}