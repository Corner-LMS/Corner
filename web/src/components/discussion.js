import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QuestionModal from '../utils/questionModal';
import AddComment from './commentForm';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const Discussions = ({ courseId }) => {
    const [questions, setQuestions] = useState([]);
    const [expandedQuestionId, setExpandedQuestionId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [questionTitle, setQuestionTitle] = useState('');
    const [questionContent, setQuestionContent] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [error, setError] = useState('');
    const [userRole, setUserRole] = useState(null);
    const [expandedContent, setExpandedContent] = useState({});
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
    const token = localStorage.getItem('teacherToken')||localStorage.getItem('studentToken');

    useEffect(() => {
        fetchQuestions();
        getUserRole();
    }, [courseId]);

    const getUserRole = () => {
        if (token) {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            setUserRole(decodedToken.role);
        }
    };

    const fetchQuestions = async () => {
        try {
            const response = await axios.get(
                `${url}/corner/course/${courseId}/questions`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setQuestions(response.data.questions);
        } catch (error) {
            console.error('Error fetching questions:', error);
            setError('Failed to fetch questions');
        }
    };

    const handleAddQuestion = async (e) => {
        e.preventDefault();
        try {
            await axios.post(
                `${url}/corner/course/${courseId}/add-question`,
                {
                    courseId,
                    title: questionTitle,
                    content: questionContent,
                    isAnonymous
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setShowModal(false);
            setQuestionTitle('');
            setQuestionContent('');
            setIsAnonymous(false);
            fetchQuestions();
        } catch (error) {
            console.error('Error adding question:', error);
            setError('Failed to add question');
        }
    };

    const handleCommentAdded = () => {
        fetchQuestions();
    };

    const toggleQuestion = (questionId) => {
        setExpandedQuestionId(expandedQuestionId === questionId ? null : questionId);
    };

    const toggleContent = (questionId, event) => {
        event.stopPropagation(); // Prevent triggering the question expansion
        setExpandedContent(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }));
    };

    const truncateText = (text, lines = 3) => {
        const words = text.split(' ');
        const averageWordsPerLine = 15; // Approximate number of words per line
        const truncateAt = lines * averageWordsPerLine;

        if (words.length > truncateAt) {
            return {
                isTruncated: true,
                text: words.slice(0, truncateAt).join(' ') + '...'
            };
        }

        return {
            isTruncated: false,
            text: text
        };
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Course Discussions</h2>
               
                    <button
                    onClick={() => setShowModal(true)}
                    className="bg-rose-600 text-white px-4 py-2 rounded-md hover:bg-rose-700 transition-colors"
                >
                    + Add Question
                </button>
            </div>

            <QuestionModal
                showModal={showModal}
                setShowModal={setShowModal}
                handleAddQuestion={handleAddQuestion}
                questionTitle={questionTitle}
                setQuestionTitle={setQuestionTitle}
                questionContent={questionContent}
                setQuestionContent={setQuestionContent}
                isAnonymous={isAnonymous}
                setIsAnonymous={setIsAnonymous}
                userRole={userRole}
            />

            {error && <p className="text-red-600">{error}</p>}

            <div className="space-y-4">
                {questions.map((question) => {
                    const contentDisplay = truncateText(question.content);
                    
                    return (
                        <div 
                            key={question._id} 
                            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200"
                        >
                            <div 
                                className="p-6 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleQuestion(question._id)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-gray-900">{question.title}</h3>
                                        <p className="text-sm mt-1 text-gray-400">
                                            Posted by {question.isAnonymous ? 'Anonymous' : question.createdBy?.name} on{' '}
                                            {new Date(question.createdAt).toLocaleString()}
                                        </p>
                                        <div className="mt-2">
                                            <p className="text-gray-700">
                                                {expandedContent[question._id] ? question.content : contentDisplay.text}
                                            </p>
                                            {contentDisplay.isTruncated && (
                                                <button
                                                    onClick={(e) => toggleContent(question._id, e)}
                                                    className="text-rose-600 hover:text-rose-700 text-sm mt-1 focus:outline-none"
                                                >
                                                    {expandedContent[question._id] ? 'Show less' : 'Show more'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        {expandedQuestionId === question._id ? (
                                            <FaChevronUp className="text-gray-400" />
                                        ) : (
                                            <FaChevronDown className="text-gray-400" />
                                        )}
                                    </div>
                                </div>
                                {!expandedQuestionId && (
                                    <p className="text-sm text-gray-400 mt-2">
                                        Click to view or add comments
                                    </p>
                                )}
                            </div>

                            {expandedQuestionId === question._id && (
                                <div className="border-t border-gray-200 bg-gray-50 p-6">
                                    <div className="space-y-4">
                                        <h4 className="font-medium text-gray-900">Comments</h4>
                                        {question.comments?.length > 0 ? (
                                            question.comments.map((comment, index) => (
                                                <div key={index} className="bg-white rounded-md p-4 shadow-sm border border-gray-200">
                                                    <div 
                                                        className="prose max-w-none" 
                                                        dangerouslySetInnerHTML={{ __html: comment.text }}
                                                    />
                                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                                        <p className="text-sm text-rose-600">
                                                            By {comment.author?.name} on {new Date(comment.timestamp).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 italic">No comments yet</p>
                                        )}
                                        <div className="mt-4">
                                            <AddComment
                                                questionId={question._id}
                                                onCommentAdded={handleCommentAdded}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Discussions; 