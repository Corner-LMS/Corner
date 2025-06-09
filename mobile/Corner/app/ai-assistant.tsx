import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../config/ firebase-config';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
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
    type: 'discussion' | 'announcement' | 'link' | 'file';
    id?: string;
    description: string;
    relevanceScore: number;
}

interface CourseContext {
    discussions: any[];
    announcements: any[];
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

    useEffect(() => {
        if (!courseId) return;

        // Load course context (discussions, announcements)
        loadCourseContext();

        // Load previous chat history
        loadChatHistory();

        // Add welcome message
        if (messages.length === 0) {
            setMessages([{
                id: 'welcome',
                content: `Hi! I'm your AI assistant for ${courseName}. I can help you with questions about the course content, discussions, announcements, and provide relevant resources. I have access to all course materials and can give you personalized assistance. What would you like to know?`,
                isUser: false,
                timestamp: new Date(),
                followUpQuestions: [
                    "What are the main topics discussed in this course?",
                    "Can you summarize recent announcements?",
                    "What resources are available for this course?",
                    "Help me understand a specific discussion topic"
                ]
            }]);
        }
    }, [courseId]);

    const loadCourseContext = async () => {
        try {
            // Load discussions
            const discussionsSnapshot = await getDocs(
                query(collection(db, 'courses', courseId as string, 'discussions'), orderBy('createdAt', 'desc'))
            );
            const discussions = discussionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Load announcements
            const announcementsSnapshot = await getDocs(
                query(collection(db, 'courses', courseId as string, 'announcements'), orderBy('createdAt', 'desc'))
            );
            const announcements = announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setCourseContext({
                discussions,
                announcements,
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
            const user = auth.currentUser;
            if (!user) return;

            const chatQuery = query(
                collection(db, 'courses', courseId as string, 'aiChats', user.uid, 'messages'),
                orderBy('timestamp', 'asc'),
                limit(50)
            );

            const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
                const chatMessages = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Message[];

                if (chatMessages.length > 0) {
                    setMessages(prev => {
                        // Remove welcome message if we have actual chat history
                        const filtered = prev.filter(msg => msg.id !== 'welcome');
                        return [...filtered, ...chatMessages];
                    });
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
            // Use OpenAI service to generate response with full course context
            const { content, followUpQuestions } = await openaiService.generateResponse(
                userMessage,
                courseContext,
                resources
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
            return {
                id: Date.now().toString(),
                content: "I'm having trouble generating a response right now. Please try rephrasing your question or check with your instructor if you need immediate help.",
                isUser: false,
                timestamp: new Date(),
                resources: resources.slice(0, 3),
                followUpQuestions: [
                    "Can you help me find course materials?",
                    "What should I review for this topic?",
                    "Are there recent announcements I should check?"
                ]
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

        // Sort by relevance score
        return resources.sort((a, b) => b.relevanceScore - a.relevanceScore);
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || isLoading) return;

        const user = auth.currentUser;
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

        // Add user message
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            // Save user message to Firestore
            await addDoc(collection(db, 'courses', courseId as string, 'aiChats', user.uid, 'messages'), {
                content: userMessage.content,
                isUser: true,
                timestamp: serverTimestamp()
            });

            // Generate AI response using OpenAI
            const aiResponse = await generateAIResponse(userMessage.content);

            // Add AI response
            setMessages(prev => [...prev, aiResponse]);

            // Save AI response to Firestore
            await addDoc(collection(db, 'courses', courseId as string, 'aiChats', user.uid, 'messages'), {
                content: aiResponse.content,
                isUser: false,
                timestamp: serverTimestamp(),
                resources: aiResponse.resources || [],
                followUpQuestions: aiResponse.followUpQuestions || []
            });

        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message. Please try again.');
        } finally {
            setIsLoading(false);
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
        } else {
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
        }
    };

    const handleFollowUpPress = (question: string) => {
        setInputText(question);
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
                                    name={resource.type === 'discussion' ? 'chatbubbles' : 'megaphone'}
                                    size={16}
                                    color="#81171b"
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
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#81171b" />
                </Pressable>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>AI Assistant</Text>
                    <Text style={styles.headerSubtitle}>{courseName}</Text>
                </View>
                <View style={styles.aiIndicator}>
                    <Ionicons name="sparkles" size={20} color="#81171b" />
                </View>
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
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
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    backButton: {
        marginRight: 16,
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(129, 23, 27, 0.08)',
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#64748b',
        marginTop: 2,
        fontWeight: '500',
    },
    aiIndicator: {
        padding: 8,
    },
    messagesContainer: {
        flex: 1,
        padding: 16,
    },
    messageContainer: {
        marginBottom: 16,
    },
    userMessage: {
        alignItems: 'flex-end',
    },
    aiMessage: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
    },
    userBubble: {
        backgroundColor: '#81171b',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userText: {
        color: '#fff',
    },
    aiText: {
        color: '#1e293b',
    },
    messageTime: {
        fontSize: 12,
        marginTop: 4,
        opacity: 0.7,
    },
    userTime: {
        color: '#fff',
        textAlign: 'right',
    },
    aiTime: {
        color: '#64748b',
    },
    resourcesContainer: {
        marginTop: 12,
        marginLeft: 16,
        maxWidth: '80%',
    },
    resourcesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8,
    },
    resourceCard: {
        backgroundColor: '#f1f5f9',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#81171b',
    },
    resourceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    resourceTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
        marginLeft: 8,
        flex: 1,
    },
    resourceDescription: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 16,
    },
    followUpContainer: {
        marginTop: 12,
        marginLeft: 16,
        maxWidth: '80%',
    },
    followUpTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8,
    },
    followUpButton: {
        backgroundColor: 'rgba(129, 23, 27, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(129, 23, 27, 0.2)',
    },
    followUpText: {
        fontSize: 13,
        color: '#81171b',
        fontWeight: '500',
    },
    loadingContainer: {
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    loadingBubble: {
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        borderBottomLeftRadius: 4,
    },
    loadingText: {
        fontSize: 16,
        color: '#64748b',
        fontStyle: 'italic',
    },
    inputContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
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
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: '#81171b',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#81171b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    sendButtonDisabled: {
        backgroundColor: '#94a3b8',
        shadowOpacity: 0.1,
    },
}); 