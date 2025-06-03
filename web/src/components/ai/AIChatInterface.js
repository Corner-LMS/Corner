import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const AIChatInterface = ({ courseName, courseId }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const axiosSource = useRef(axios.CancelToken.source());
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
    const token = localStorage.getItem('teacherToken')||localStorage.getItem('studentToken');

    const getUserId = () => {
        if (token) {
            try {
                const decodedToken = JSON.parse(atob(token.split('.')[1])); // Decode JWT token

                return decodedToken.userId; 
            } catch (error) {
                console.error('Error decoding token:', error);
                return null;
            }
        }
        return null;
    };

    // Modified useEffect to fetch chat history
    useEffect(() => {
        const fetchChatHistory = async () => {
            try {
                const userId = getUserId();
                if (!userId) throw new Error('User ID not found');

                const response = await axios.get(`${baseUrl}/corner/ai/chat/history`, {
                    params: {
                        courseId,
                        userId
                    },
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.data.history && response.data.history.length > 0) {
                    // Convert history to message format
                    const formattedMessages = response.data.history.flatMap(entry => [
                        { text: entry.prompt, sender: 'user' },
                        { text: entry.response, sender: 'assistant' }
                    ]);
                    setMessages(formattedMessages);
                } else {
                    // If no history, fetch welcome message
                    const welcomeResponse = await axios.post(`${baseUrl}/corner/ai/chat`, {
                        prompt: "Provide welcome message and 5 recommended resources",
                        courseName,
                        courseId,
                        userId
                    }, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    setMessages([{
                        text: welcomeResponse.data.message,
                        sender: 'assistant'
                    }]);
                }
            } catch (error) {
                if (!axios.isCancel(error)) {
                    setMessages([{
                        text: `Welcome to ${courseName}! Ask me about the course or say "resources" for recommendations.`,
                        sender: 'assistant'
                    }]);
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchChatHistory();

        return () => {
            axiosSource.current.cancel('Component unmounted');
        };
    }, [courseName, courseId]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        try {
            // Add user message immediately
            const userMessage = { text: input, sender: 'user' };
            setMessages(prev => [...prev, userMessage]);
            setInput('');
            setIsLoading(true);

            // Get userId from token
            const userId = getUserId();
            if (!userId) {
                throw new Error('User ID not found');
            }

            const response = await axios.post(`${baseUrl}/corner/ai/chat`, {
                prompt: input,
                courseId,
                courseName,
                userId
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Add AI response
            setMessages(prev => [...prev, {
                text: response.data.message,
                sender: 'assistant'
            }]);

        } catch (error) {
            console.error('Chat error:', error); // More detailed error logging
            setMessages(prev => [...prev, {
                text: "Sorry, I couldn't process your request. Please try again.",
                sender: 'assistant'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-scroll and cleanup
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        return () => {
            axiosSource.current.cancel('Component unmounted');
        };
    }, [messages]);

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto bg-gray-50 rounded-lg shadow-md">
            {/* Header */}
            <div className="p-4 bg-rose-700 text-white rounded-t-lg">
                <h2 className="text-xl font-bold">{courseName} Assistant</h2>
            </div>

            {/* Messages Container */}
            <div className="flex-1 p-4 overflow-y-auto max-h-[60vh]">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`mb-4 p-3 rounded-lg ${msg.sender === 'user'
                            ? 'bg-indigo-100 ml-auto max-w-[80%]'
                            : 'bg-white mr-auto max-w-[80%] shadow-sm'}`}
                    >
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                ))}

                {isLoading && (
                    <div className="mb-4 p-3 bg-white mr-auto max-w-[80%] shadow-sm rounded-lg">
                        <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about the course..."
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading}
                        className="px-4 py-2 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChatInterface;