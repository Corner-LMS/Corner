import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    content: string;
    timestamp: string;
    read: boolean;
    courseId: string;
    courseName: string;
}

export default function CourseConversationScreen() {
    const params = useLocalSearchParams();
    const courseId = params.courseId as string;
    const courseName = params.courseName as string;
    const otherUserId = params.otherUserId as string;
    const otherUserName = params.otherUserName as string;
    const otherUserRole = params.otherUserRole as string;

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [userData, setUserData] = useState<any>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        loadUserAndMessages();

        // Add keyboard listeners
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            (e) => {
                setKeyboardHeight(e.endCoordinates.height);
                // Scroll to bottom when keyboard appears
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
            }
        );

        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => {
                setKeyboardHeight(0);
            }
        );

        return () => {
            keyboardDidShowListener?.remove();
            keyboardDidHideListener?.remove();
        };
    }, [courseId, otherUserId]);

    const loadUserAndMessages = async () => {
        try {
            const user = auth().currentUser;
            if (!user) return;

            const userDoc = await firestore().collection('users').doc(user.uid).get();
            if (userDoc.exists()) {
                setUserData(userDoc.data());
            }

            await loadMessages(user.uid);
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (userId: string) => {
        try {
            // Get messages between the two users for this specific course
            const messagesQuery = await firestore()
                .collection('messages')
                .where('courseId', '==', courseId)
                .where('senderId', 'in', [userId, otherUserId])
                .where('receiverId', 'in', [userId, otherUserId])
                .orderBy('timestamp', 'asc')
                .get();

            const messagesList: Message[] = [];

            for (const messageDoc of messagesQuery.docs) {
                const messageData = messageDoc.data();

                // Only include messages between these two users for this course
                if ((messageData.senderId === userId && messageData.receiverId === otherUserId) ||
                    (messageData.senderId === otherUserId && messageData.receiverId === userId)) {

                    messagesList.push({
                        id: messageDoc.id,
                        senderId: messageData.senderId,
                        senderName: messageData.senderName,
                        receiverId: messageData.receiverId,
                        receiverName: messageData.receiverName,
                        content: messageData.content,
                        timestamp: messageData.timestamp,
                        read: messageData.read || false,
                        courseId: messageData.courseId,
                        courseName: messageData.courseName
                    });

                    // Mark received messages as read
                    if (messageData.receiverId === userId && !messageData.read) {
                        try {
                            await firestore().collection('messages').doc(messageDoc.id).update({
                                read: true
                            });
                        } catch (error) {
                            console.error('Error marking message as read:', error);
                        }
                    }
                }
            }

            setMessages(messagesList);

            // Scroll to bottom after messages load
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !userData) return;

        try {
            setSending(true);
            const user = auth().currentUser;
            if (!user) return;

            const messageData = {
                senderId: user.uid,
                senderName: userData.name || 'Unknown',
                receiverId: otherUserId,
                receiverName: otherUserName,
                content: newMessage.trim(),
                timestamp: new Date().toISOString(),
                read: false,
                courseId: courseId,
                courseName: courseName
            };

            await firestore().collection('messages').add(messageData);

            // Add message to local state
            const newMessageObj: Message = {
                id: Date.now().toString(), // Temporary ID
                ...messageData
            };

            setMessages(prev => [...prev, newMessageObj]);
            setNewMessage('');

            // Scroll to bottom
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.header}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{otherUserName}</Text>
                        <View style={styles.headerSpacer} />
                    </View>
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4f46e5" />
                    <Text style={styles.loadingText}>Loading conversation...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>{otherUserName}</Text>
                        <Text style={styles.headerSubtitle}>
                            {otherUserRole === 'teacher' ? 'Teacher' : 'Student'} • {courseName}
                        </Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>
            </LinearGradient>

            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={() => Keyboard.dismiss()}
                >
                    {messages.map((message) => {
                        const isOwnMessage = message.senderId === auth().currentUser?.uid;
                        return (
                            <View
                                key={message.id}
                                style={[
                                    styles.messageContainer,
                                    isOwnMessage ? styles.ownMessage : styles.otherMessage
                                ]}
                            >
                                <View
                                    style={[
                                        styles.messageBubble,
                                        isOwnMessage ? styles.ownBubble : styles.otherBubble
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.messageText,
                                            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                                        ]}
                                    >
                                        {message.content}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.messageTime,
                                            isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
                                        ]}
                                    >
                                        {formatTimestamp(message.timestamp)}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        placeholder="Type a message..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        maxLength={1000}
                        onFocus={() => {
                            setTimeout(() => {
                                scrollViewRef.current?.scrollToEnd({ animated: true });
                            }, 100);
                        }}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!newMessage.trim() || sending) && styles.sendButtonDisabled
                        ]}
                        onPress={handleSendMessage}
                        disabled={!newMessage.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={20} color="#fff" />
                        )}
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
        paddingTop: 0,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    headerSpacer: {
        width: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
        fontWeight: '500',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    messageContainer: {
        marginBottom: 12,
    },
    ownMessage: {
        alignItems: 'flex-end',
    },
    otherMessage: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
    },
    ownBubble: {
        backgroundColor: '#4f46e5',
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#e2e8f0',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
        marginBottom: 4,
    },
    ownMessageText: {
        color: '#fff',
    },
    otherMessageText: {
        color: '#1a202c',
    },
    messageTime: {
        fontSize: 12,
        alignSelf: 'flex-end',
    },
    ownMessageTime: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    otherMessageTime: {
        color: '#94a3b8',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingBottom: Platform.OS === 'ios' ? 12 : 12,
    },
    textInput: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 12,
        fontSize: 16,
        maxHeight: 100,
        minHeight: 44,
        textAlignVertical: 'center',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#cbd5e0',
    },
}); 