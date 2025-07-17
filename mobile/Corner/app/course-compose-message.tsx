import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

export default function CourseComposeMessageScreen() {
    const params = useLocalSearchParams();
    const courseId = params.courseId as string;
    const courseName = params.courseName as string;
    const role = params.role as string;

    const [content, setContent] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [showUserPicker, setShowUserPicker] = useState(false);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        loadUserData();
        loadCourseUsers();
    }, [courseId]);

    const loadUserData = async () => {
        try {
            const user = auth().currentUser;
            if (!user) return;

            const userDoc = await firestore().collection('users').doc(user.uid).get();
            if (userDoc.exists()) {
                setUserData(userDoc.data());
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };

    const loadCourseUsers = async () => {
        try {
            setLoading(true);
            const user = auth().currentUser;
            if (!user) return;

            let usersQuery;

            if (role === 'teacher') {
                // Teachers can message students from this course
                usersQuery = await firestore()
                    .collection('users')
                    .where('role', '==', 'student')
                    .where('courseIds', 'array-contains', courseId)
                    .get();
            } else {
                // Students can message teachers and other students from this course
                const courseDoc = await firestore().collection('courses').doc(courseId).get();
                const usersList: User[] = [];

                if (courseDoc.exists()) {
                    // Add the teacher
                    const teacherId = courseDoc.data()?.teacherId;
                    if (teacherId) {
                        const teacherDoc = await firestore().collection('users').doc(teacherId).get();
                        if (teacherDoc.exists()) {
                            const teacherData = teacherDoc.data();
                            usersList.push({
                                id: teacherId,
                                name: teacherData?.name || 'Unknown',
                                email: teacherData?.email || '',
                                role: 'teacher'
                            });
                        }
                    }

                    // Add other students enrolled in this course
                    const studentsQuery = await firestore()
                        .collection('users')
                        .where('role', '==', 'student')
                        .where('courseIds', 'array-contains', courseId)
                        .get();

                    studentsQuery.docs.forEach(doc => {
                        const studentData = doc.data();
                        usersList.push({
                            id: doc.id,
                            name: studentData?.name || 'Unknown',
                            email: studentData?.email || '',
                            role: 'student'
                        });
                    });
                }

                setUsers(usersList.filter(user => user.id !== auth().currentUser?.uid));
                setLoading(false);
                return;
            }

            if (usersQuery) {
                const usersList: User[] = usersQuery.docs
                    .map(doc => ({
                        id: doc.id,
                        name: doc.data().name || 'Unknown',
                        email: doc.data().email || '',
                        role: doc.data().role || ''
                    }))
                    .filter(user => user.id !== auth().currentUser?.uid);

                setUsers(usersList);
            }
        } catch (error) {
            console.error('Error loading course users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!selectedUser) {
            Alert.alert('Error', 'Please select a recipient.');
            return;
        }

        if (!content.trim()) {
            Alert.alert('Error', 'Please enter a message.');
            return;
        }

        try {
            setSending(true);
            const user = auth().currentUser;
            if (!user || !userData) return;

            const messageData = {
                senderId: user.uid,
                senderName: userData.name || 'Unknown',
                receiverId: selectedUser.id,
                receiverName: selectedUser.name,
                content: content.trim(),
                timestamp: new Date().toISOString(),
                read: false,
                courseId: courseId,
                courseName: courseName
            };

            await firestore().collection('messages').add(messageData);

            Alert.alert(
                'Success',
                'Message sent successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]
            );
        } catch (error) {
            console.error('Error sending message:', error);
            Alert.alert('Error', 'Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleUserSelect = (user: User) => {
        setSelectedUser(user);
        setShowUserPicker(false);
    };

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

                    <Text style={styles.headerTitle}>New Message</Text>

                    <View style={styles.headerSpacer} />
                </View>
            </LinearGradient>

            <ScrollView style={styles.content}>
                {/* Course Context */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Course:</Text>
                    <View style={styles.courseContext}>
                        <Ionicons name="school" size={16} color="#4f46e5" />
                        <Text style={styles.courseContextText}>{courseName}</Text>
                    </View>
                </View>

                {/* Recipient Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>To:</Text>
                    {selectedUser ? (
                        <TouchableOpacity
                            style={styles.selectedUserCard}
                            onPress={() => setShowUserPicker(true)}
                        >
                            <View style={styles.userAvatar}>
                                <Text style={styles.avatarText}>
                                    {selectedUser.name.substring(0, 2).toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{selectedUser.name}</Text>
                                <Text style={styles.userEmail}>{selectedUser.email}</Text>
                            </View>
                            <Ionicons name="chevron-down" size={20} color="#64748b" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.selectUserButton}
                            onPress={() => setShowUserPicker(true)}
                        >
                            <Ionicons name="person-add" size={20} color="#64748b" />
                            <Text style={styles.selectUserText}>Select Recipient</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Message Content */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Message:</Text>
                    <TextInput
                        style={styles.contentInput}
                        value={content}
                        onChangeText={setContent}
                        placeholder="Type your message here..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                {/* Send Button */}
                <View style={styles.sendButtonContainer}>
                    <TouchableOpacity
                        style={[styles.sendButtonLarge, (!selectedUser || !content.trim() || sending) && styles.sendButtonDisabled]}
                        onPress={handleSendMessage}
                        disabled={!selectedUser || !content.trim() || sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="send" size={20} color="#fff" />
                                <Text style={styles.sendButtonText}>Send Message</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* User Picker Modal */}
            {showUserPicker && (
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        onPress={() => setShowUserPicker(false)}
                    />
                    <View style={styles.userPickerModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Recipient</Text>
                            <TouchableOpacity onPress={() => setShowUserPicker(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#4f46e5" />
                                <Text style={styles.loadingText}>Loading users...</Text>
                            </View>
                        ) : users.length > 0 ? (
                            <ScrollView style={styles.usersList}>
                                {users.map((user) => (
                                    <TouchableOpacity
                                        key={user.id}
                                        style={styles.userOption}
                                        onPress={() => handleUserSelect(user)}
                                    >
                                        <View style={styles.userAvatar}>
                                            <Text style={styles.avatarText}>
                                                {user.name.substring(0, 2).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={styles.userInfo}>
                                            <Text style={styles.userName}>{user.name}</Text>
                                            <Text style={styles.userEmail}>{user.email}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="people-outline" size={48} color="#cbd5e0" />
                                <Text style={styles.emptyStateText}>No users available in this course</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}
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
        justifyContent: 'space-between',
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
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: 8,
    },
    courseContext: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#0ea5e9',
    },
    courseContextText: {
        fontSize: 16,
        color: '#0c4a6e',
        fontWeight: '500',
        marginLeft: 8,
    },
    selectedUserCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    selectUserButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
    },
    selectUserText: {
        fontSize: 16,
        color: '#64748b',
        marginLeft: 12,
    },
    userAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: 2,
    },
    userEmail: {
        fontSize: 14,
        color: '#64748b',
    },
    contentInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1a202c',
        minHeight: 120,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sendButtonContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    sendButtonLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4f46e5',
        borderRadius: 12,
        paddingVertical: 14,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    sendButtonDisabled: {
        backgroundColor: '#3730a3',
    },
    sendButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 8,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    userPickerModal: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '90%',
        maxHeight: '70%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a202c',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
    },
    usersList: {
        maxHeight: 400,
    },
    userOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 16,
        color: '#64748b',
        marginTop: 16,
        textAlign: 'center',
    },
}); 