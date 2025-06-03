// FileUploadForm.js
import { useState } from 'react';
import axios from 'axios';

const URL = process.env.NEXT_PUBLIC_BASE_URL||'http://localhost:5001';
export default function FileUploadForm({ moduleId, type, onSuccess }) {
    const [title, setTitle] = useState('');
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;

        setIsLoading(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('type', type);
        formData.append('moduleId', moduleId);

        try {
            const res = await axios.post(`${URL}/corner/module-items/`, formData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('teacherToken')}`,
                    'Content-Type': 'multipart/form-data'
                },
            
            });
            console.log("File Upload Response", res.data);

            if (res.status === 201) {
                onSuccess(res.data);
                setTitle('');
                setFile(null);
            }
        } catch (err) {
            console.error('Failed to upload file', err);
            alert('Failed to upload file');
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

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <label className="flex flex-col items-center justify-center cursor-pointer">
                    <div className="flex flex-col items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-500 mt-2">
                            {file ? file.name : `Click to upload ${type === 'video' ? 'a video' : 'a document'}`}
                        </p>
                    </div>
                    <input
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="hidden"
                        accept={type === 'video' ? 'video/*' : 'application/pdf, .doc, .docx'}
                        required
                    />
                </label>
            </div>

            {file && (
                <div className="flex items-center text-sm text-gray-500">
                    <span>Selected: {file.name}</span>
                    <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="ml-2 text-red-500"
                    >
                        Remove
                    </button>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isLoading || !file}
                    className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-400"
                >
                    {isLoading ? 'Uploading...' : 'Upload File'}
                </button>
            </div>
        </form>
    );
}