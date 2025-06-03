import React, { useState } from 'react';

const QuestionModal = ({ showModal, setShowModal, handleAddQuestion, questionTitle, setQuestionTitle, questionContent, setQuestionContent, isAnonymous, setIsAnonymous, userRole }) => {
    return (
        <div>
            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="flex justify-between items-center mb-4">
                            <h5 className="text-lg font-semibold text-gray-900">Add a Question</h5>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleAddQuestion}>
                            <div className="mb-4">
                                <label htmlFor="questionTitle" className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    placeholder="Enter your question title"
                                    value={questionTitle}
                                    onChange={(e) => setQuestionTitle(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="questionContent" className="block text-sm font-medium text-gray-700 mb-1">
                                    Content
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    rows="4"
                                    placeholder="Describe your question"
                                    value={questionContent}
                                    onChange={(e) => setQuestionContent(e.target.value)}
                                    required
                                />
                            </div>
                            {userRole === 'student' && (
                                <div className="mb-4">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                                            checked={isAnonymous}
                                            onChange={(e) => setIsAnonymous(e.target.checked)}
                                        />
                                        <span className="ml-2 text-sm text-gray-600">Post as Anonymous</span>
                                    </label>
                                </div>
                            )}
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700"
                                >
                                    Add Question
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionModal;
