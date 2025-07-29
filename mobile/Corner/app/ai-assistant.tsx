import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { openaiService } from '../services/openaiService';

interface Message {
    id: string;
    content: string;
    isUser: boolean;
    timestamp: any;
    resources?: ResourceRecommendation[];
    followUpQuestions?: string[];
}

interface ResourceRecommendation {
    title: string;
    type: 'discussion' | 'announcement' | 'link' | 'text';
    id?: string;
    description: string;
    relevanceScore: number;
}

interface CourseContext {
    discussions: any[];
    announcements: any[];
    resources: any[];
    courseName: string;
    courseCode: string;
    instructorName: string;
}

export default function AIAssistantScreen() {
    const params = useLocalSearchParams();
    const { courseId, courseName, courseCode, instructorName, role } = params;

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [courseContext, setCourseContext] = useState<CourseContext | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (messages.length > 0) {
            // Use a longer delay to ensure content is rendered
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 300);
        }
    }, [messages]);

    // Auto-scroll when loading state changes (when AI response arrives)
    useEffect(() => {
        if (!isLoading && messages.length > 0) {
            // Use a longer delay to ensure AI response is fully rendered
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 500);
        }
    }, [isLoading, messages.length]);

    // Additional auto-scroll when new messages are added
    const scrollToBottom = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    useEffect(() => {
        if (!courseId) return;

        // Load course context (discussions, announcements)
        loadCourseContext();

        // Load previous chat history
        loadChatHistory();

        // Add welcome message
        if (messages.length === 0) {
            const welcomeMessage = role === 'teacher'
                ? `Hi! I'm your co-instructor AI assistant for ${courseName}. I can help you analyze student engagement, draft announcements, summarize discussion trends, and provide insights into what students are struggling with. How can I support your teaching today?`
                : `Hi! I'm your AI assistant for ${courseName}. I can help you with questions about the course content, discussions, announcements, and provide relevant resources. I have access to all course materials and can give you personalized assistance. What would you like to know?`;

            const welcomeFollowUps = role === 'teacher'
                ? [
                    "What are students confused about this week?",
                    "Help me draft an announcement",
                    "Summarize recent discussion trends",
                    "What topics need more attention?"
                ]
                : [
                    "What are the main topics discussed in this course?",
                    "Can you summarize recent announcements?",
                    "What resources are available for this course?",
                    "Help me understand a specific discussion topic"
                ];

            setMessages([{
                id: 'welcome',
                content: welcomeMessage,
                isUser: false,
                timestamp: new Date(),
                followUpQuestions: welcomeFollowUps
            }]);
            // Scroll to bottom after welcome message is added
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
    }, [courseId, role]);

    const loadCourseContext = async () => {
        try {
            // Load discussions
            const discussionsSnapshot = await firestore().collection('courses').doc(courseId as string).collection('discussions').orderBy('createdAt', 'desc').get();
            const discussions = discussionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Load announcements
            const announcementsSnapshot = await firestore().collection('courses').doc(courseId as string).collection('announcements').orderBy('createdAt', 'desc').get();
            const announcements = announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Load course resources
            const resourcesSnapshot = await firestore().collection('courses').doc(courseId as string).collection('resources').orderBy('createdAt', 'desc').get();
            const resources = resourcesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setCourseContext({
                discussions,
                announcements,
                resources,
                courseName: courseName as string,
                courseCode: courseCode as string,
                instructorName: instructorName as string
            });
        } catch (error) {
            console.error('Error loading course context:', error);
        }
    };

    const loadChatHistory = async () => {
        try {
            const user = auth().currentUser;
            if (!user) return;

            const chatQuery = firestore().collection('courses').doc(courseId as string).collection('aiChats').doc(user.uid).collection('messages').orderBy('timestamp', 'asc').limit(50);

            const unsubscribe = chatQuery.onSnapshot((snapshot) => {
                const chatMessages = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data() as any
                })) as Message[];

                if (chatMessages.length > 0) {
                    setMessages(prev => {
                        // Remove welcome message if we have actual chat history
                        const filtered = prev.filter(msg => msg.id !== 'welcome');
                        return [...filtered, ...chatMessages];
                    });
                    // Scroll to bottom after chat history is loaded
                    setTimeout(() => {
                        scrollToBottom();
                    }, 200);
                }
            });

            return unsubscribe;
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    };

    const generateAIResponse = async (userMessage: string): Promise<Message> => {
        if (!courseContext) {
            return {
                id: Date.now().toString(),
                content: "I'm still loading the course information. Please try again in a moment.",
                isUser: false,
                timestamp: new Date(),
                resources: [],
                followUpQuestions: ["Can you repeat your question?"]
            };
        }

        // Find relevant resources first
        const resources = findRelevantResources(userMessage);

        try {
            // Use OpenAI service to generate response with full course context and user role
            const { content, followUpQuestions } = await openaiService.generateResponse(
                userMessage,
                courseContext,
                resources,
                role as 'teacher' | 'student'
            );

            return {
                id: Date.now().toString(),
                content,
                isUser: false,
                timestamp: new Date(),
                resources: resources.slice(0, 3), // Show top 3 resources
                followUpQuestions: followUpQuestions.slice(0, 3) // Show top 3 follow-ups
            };

        } catch (error) {
            console.error('Error generating AI response:', error);

            // Fallback to basic response if OpenAI fails
            const fallbackMessage = role === 'teacher'
                ? "I'm having trouble generating a response right now. Please try rephrasing your question or let me know what specific aspect of course management you'd like help with."
                : "I'm having trouble generating a response right now. Please try rephrasing your question or check with your instructor if you need immediate help.";

            const fallbackFollowUps = role === 'teacher'
                ? [
                    "What specific student questions should I address?",
                    "Help me analyze discussion patterns",
                    "What announcements should I consider?"
                ]
                : [
                    "Can you help me find course materials?",
                    "What should I review for this topic?",
                    "Are there recent announcements I should check?"
                ];

            return {
                id: Date.now().toString(),
                content: fallbackMessage,
                isUser: false,
                timestamp: new Date(),
                resources: resources.slice(0, 3),
                followUpQuestions: fallbackFollowUps
            };
        }
    };

    const findRelevantResources = (query: string): ResourceRecommendation[] => {
        if (!courseContext) return [];

        const resources: ResourceRecommendation[] = [];
        const queryLower = query.toLowerCase();

        // Search discussions
        courseContext.discussions.forEach(discussion => {
            const titleMatch = discussion.title?.toLowerCase().includes(queryLower);
            const contentMatch = discussion.content?.toLowerCase().includes(queryLower);

            if (titleMatch || contentMatch) {
                resources.push({
                    title: discussion.title,
                    type: 'discussion',
                    id: discussion.id,
                    description: discussion.content.substring(0, 100) + '...',
                    relevanceScore: titleMatch ? 0.9 : 0.6
                });
            }
        });

        // Search announcements
        courseContext.announcements.forEach(announcement => {
            const titleMatch = announcement.title?.toLowerCase().includes(queryLower);
            const contentMatch = announcement.content?.toLowerCase().includes(queryLower);

            if (titleMatch || contentMatch) {
                resources.push({
                    title: announcement.title,
                    type: 'announcement',
                    id: announcement.id,
                    description: announcement.content.substring(0, 100) + '...',
                    relevanceScore: titleMatch ? 0.8 : 0.5
                });
            }
        });

        // Search course resources (links, text)
        courseContext.resources.forEach(resource => {
            const titleMatch = resource.title?.toLowerCase().includes(queryLower);
            const descriptionMatch = resource.description?.toLowerCase().includes(queryLower);
            const contentMatch = resource.type === 'text' && resource.content?.toLowerCase().includes(queryLower);

            if (titleMatch || descriptionMatch || contentMatch) {
                let description = '';
                if (resource.description) {
                    description = resource.description;
                } else if (resource.type === 'text') {
                    description = resource.content.substring(0, 100) + '...';
                } else if (resource.type === 'link') {
                    description = `Link: ${resource.content}`;
                }

                resources.push({
                    title: resource.title,
                    type: resource.type as 'link' | 'text',
                    id: resource.id,
                    description,
                    relevanceScore: titleMatch ? 0.95 : (descriptionMatch ? 0.7 : 0.6)
                });
            }
        });

        // Sort by relevance score
        return resources.sort((a, b) => b.relevanceScore - a.relevanceScore);
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || isLoading) return;

        const user = auth().currentUser;
        if (!user) {
            Alert.alert('Error', 'You must be logged in to use the AI assistant.');
            return;
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            content: inputText.trim(),
            isUser: true,
            timestamp: new Date()
        };

        // Add user message and scroll to bottom
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);
        scrollToBottom(); // Scroll after user message

        try {
            // Save user message to Firestore
            await firestore().collection('courses').doc(courseId as string).collection('aiChats').doc(user.uid).collection('messages').add({
                content: userMessage.content,
                isUser: true,
                timestamp: firestore.FieldValue.serverTimestamp()
            });

            // Generate AI response using OpenAI
            const aiResponse = await generateAIResponse(userMessage.content);

            // Add AI response and scroll to bottom
            setMessages(prev => [...prev, aiResponse]);
            scrollToBottom(); // Scroll after AI response

            // Save AI response to Firestore
            await firestore().collection('courses').doc(courseId as string).collection('aiChats').doc(user.uid).collection('messages').add({
                content: aiResponse.content,
                isUser: false,
                timestamp: firestore.FieldValue.serverTimestamp(),
                resources: aiResponse.resources || [],
                followUpQuestions: aiResponse.followUpQuestions || []
            });

        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message. Please try again.');
        } finally {
            setIsLoading(false);
            // Scroll to bottom after loading finishes
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
    };

    const handleResourcePress = (resource: ResourceRecommendation) => {
        if (resource.type === 'discussion') {
            router.push({
                pathname: '/discussion-detail',
                params: {
                    courseId: courseId,
                    discussionId: resource.id,
                    discussionTitle: resource.title,
                    courseName: courseName,
                    role: role
                }
            });
        } else if (resource.type === 'announcement') {
            // Navigate back to course detail to view announcement
            router.push({
                pathname: '/course-detail',
                params: {
                    courseId: courseId,
                    courseName: courseName,
                    courseCode: courseCode,
                    instructorName: instructorName,
                    role: role
                }
            });
        } else if (resource.type === 'link' || resource.type === 'text') {
            // Navigate to course resources page
            router.push({
                pathname: '/course-resources',
                params: {
                    courseId: courseId,
                    courseName: courseName,
                    role: role
                }
            });
        }
    };

    const handleFollowUpPress = (question: string) => {
        setInputText(question);
        // Scroll to bottom when follow-up question is selected
        setTimeout(() => {
            scrollToBottom();
        }, 100);
    };

    const formatTime = (timestamp: any) => {
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessage = (message: Message, msgIndex: number) => (
        <View key={`${message.id}-${msgIndex}`} style={[
            styles.messageContainer,
            message.isUser ? styles.userMessage : styles.aiMessage
        ]}>
            <View style={[
                styles.messageBubble,
                message.isUser ? styles.userBubble : styles.aiBubble
            ]}>
                <Text style={[
                    styles.messageText,
                    message.isUser ? styles.userText : styles.aiText
                ]}>
                    {message.content}
                </Text>
                <Text style={[
                    styles.messageTime,
                    message.isUser ? styles.userTime : styles.aiTime
                ]}>
                    {formatTime(message.timestamp)}
                </Text>
            </View>

            {/* Resources */}
            {!message.isUser && message.resources && message.resources.length > 0 && (
                <View style={styles.resourcesContainer}>
                    <Text style={styles.resourcesTitle}>📚 Relevant Resources:</Text>
                    {message.resources.map((resource, resIndex) => (
                        <TouchableOpacity
                            key={`${message.id}-res-${resIndex}-${resource.id}`}
                            style={styles.resourceCard}
                            onPress={() => handleResourcePress(resource)}
                        >
                            <View style={styles.resourceHeader}>
                                <Ionicons
                                    name={resource.type === 'discussion' ? 'chatbubbles' :
                                        resource.type === 'announcement' ? 'megaphone' :
                                            resource.type === 'link' ? 'link' : 'reader'}
                                    size={16}
                                    color="#4f46e5"
                                />
                                <Text style={styles.resourceTitle}>{resource.title}</Text>
                            </View>
                            <Text style={styles.resourceDescription}>{resource.description}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Follow-up Questions */}
            {!message.isUser && message.followUpQuestions && message.followUpQuestions.length > 0 && (
                <View style={styles.followUpContainer}>
                    <Text style={styles.followUpTitle}>💡 You might also ask:</Text>
                    {message.followUpQuestions.map((question, fuIndex) => (
                        <TouchableOpacity
                            key={`${message.id}-fu-${fuIndex}`}
                            style={styles.followUpButton}
                            onPress={() => handleFollowUpPress(question)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.followUpText}>{question}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </Pressable>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>AI Assistant</Text>
                    <Text style={styles.headerSubtitle}>
                        {courseName} • {role === 'teacher' ? 'Teacher' : 'Student'}
                    </Text>
                </View>
                <View style={styles.aiIndicator}>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                </View>
            </LinearGradient>

            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >
                {messages.map(renderMessage)}
                {isLoading && (
                    <View style={styles.loadingContainer}>
                        <View style={styles.loadingBubble}>
                            <Text style={styles.loadingText}>AI is thinking...</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.inputContainer}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Ask me anything about this course..."
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                        placeholderTextColor="#666"
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
                        onPress={handleSendMessage}
                        disabled={!inputText.trim() || isLoading}
                    >
                        <Ionicons name="send" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        marginRight: 16,
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
        fontWeight: '500',
    },
    aiIndicator: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    messagesContainer: {
        flex: 1,
        padding: 20,
    },
    messageContainer: {
        marginBottom: 20,
    },
    userMessage: {
        alignItems: 'flex-end',
    },
    aiMessage: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        maxWidth: '85%',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 20,
    },
    userBubble: {
        backgroundColor: '#4f46e5',
        borderBottomRightRadius: 6,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    aiBubble: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '500',
    },
    userText: {
        color: '#fff',
    },
    aiText: {
        color: '#1e293b',
    },
    messageTime: {
        fontSize: 12,
        marginTop: 6,
        opacity: 0.7,
        fontWeight: '500',
    },
    userTime: {
        color: '#fff',
        textAlign: 'right',
    },
    aiTime: {
        color: '#64748b',
    },
    resourcesContainer: {
        marginTop: 16,
        marginLeft: 20,
        maxWidth: '85%',
    },
    resourcesTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 12,
        letterSpacing: 0.3,
    },
    resourceCard: {
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#4f46e5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    resourceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    resourceTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginLeft: 10,
        flex: 1,
        lineHeight: 20,
    },
    resourceDescription: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
        fontWeight: '500',
    },
    followUpContainer: {
        marginTop: 16,
        marginLeft: 20,
        maxWidth: '85%',
    },
    followUpTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 12,
        letterSpacing: 0.3,
    },
    followUpButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    followUpText: {
        fontSize: 14,
        color: '#1e293b',
        fontWeight: '500',
        lineHeight: 20,
    },
    loadingContainer: {
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    loadingBubble: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 20,
        borderBottomLeftRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    loadingText: {
        fontSize: 16,
        color: '#64748b',
        fontStyle: 'italic',
        fontWeight: '500',
    },
    inputContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
    },
    textInput: {
        flex: 1,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        maxHeight: 120,
        lineHeight: 22,
        fontWeight: '500',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    sendButton: {
        backgroundColor: '#4f46e5',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    sendButtonDisabled: {
        backgroundColor: '#94a3b8',
        shadowOpacity: 0.1,
    },
}); 