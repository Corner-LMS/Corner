import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Quill from 'quill';
import DOMPurify from 'dompurify';
import 'quill/dist/quill.snow.css';
import '../styles/comment.css';

const AddComment = ({ questionId, onCommentAdded }) => {
    const [error, setError] = useState('');
    const quillRef = useRef(null);
    const quillInstance = useRef(null);
    const token = localStorage.getItem('studentToken') || localStorage.getItem('teacherToken');

    useEffect(() => {
        if (!quillInstance.current && quillRef.current) {
            quillInstance.current = new Quill(quillRef.current, {
                theme: 'snow',
                placeholder: 'Write your comment...',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['link'],
                    ],
                },
            });
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const quill = quillInstance.current;
        const rawHTML = quill.root.innerHTML.trim();
        const sanitizedHTML = DOMPurify.sanitize(rawHTML);

        if (!sanitizedHTML || sanitizedHTML === '<p><br></p>') {
            setError('Comment cannot be empty');
            return;
        }

        try {
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001'}/corner/course/add-comment/${questionId}`,
                { text: sanitizedHTML },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            onCommentAdded(response.data.question.comments);
            quill.setContents([]);
            setError('');
        } catch (error) {
            setError('Failed to add comment');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-4">
            <div className="border rounded-md overflow-hidden bg-white">
                <div
                    ref={quillRef}
                    className="quill-editor"
                    style={{ 
                        minHeight: '100px',
                        backgroundColor: 'white',
                    }}
                />
            </div>
            <div className="flex justify-end mt-2">
                <button 
                    type="submit" 
                    className="bg-rose-600 text-white px-4 py-2 rounded-md hover:bg-rose-700 transition-colors"
                >
                    Add Comment
                </button>
            </div>
            {error && (
                <p className="text-red-600 text-sm mt-2">{error}</p>
            )}
        </form>
    );
};

export default AddComment;
