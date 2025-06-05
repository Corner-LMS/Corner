import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from './firebase/config';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc } from 'firebase/firestore';

interface Announcement {
    id: string;
    title: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
}

interface Discussion {
    id: string;
    title: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
    replies: number;
    isAnonymous?: boolean;
}

export default function CourseDetailScreen() {
    const params = useLocalSearchParams();
    const { courseId, courseName, courseCode, instructorName, role } = params;

    const [activeTab, setActiveTab] = useState<'announcements' | 'discussions'>('announcements');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [discussions, setDiscussions] = useState<Discussion[]>([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);

    useEffect(() => {
        if (!courseId) return;

        // Listen to announcements
        const announcementsQuery = query(
            collection(db, 'courses', courseId as string, 'announcements'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeAnnouncements = onSnapshot(announcementsQuery, (snapshot) => {
            const announcementsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Announcement[];
            setAnnouncements(announcementsList);
        });

        // Listen to discussions
        const discussionsQuery = query(
            collection(db, 'courses', courseId as string, 'discussions'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeDiscussions = onSnapshot(discussionsQuery, (snapshot) => {
            const discussionsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Discussion[];
            setDiscussions(discussionsList);
        });

        return () => {
            unsubscribeAnnouncements();
            unsubscribeDiscussions();
        };
    }, [courseId]);

    const handleCreate = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            Alert.alert('Error', 'Please fill in both title and content.');
            return;
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'You must be logged in.');
                return;
            }

            // Get author name based on role
            let authorName: string;
            if (role === 'teacher') {
                // Use the instructorName passed as parameter
                authorName = instructorName as string;
            } else {
                // For students, fetch name from Firestore
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.data();
                authorName = userData?.name || 'Anonymous';
            }

            const collectionName = activeTab;
            const postData: any = {
                title: newTitle.trim(),
                content: newContent.trim(),
                createdAt: serverTimestamp(),
                authorRole: role,
                authorId: user.uid,
                replies: 0
            };

            postData.authorName = authorName;
            console.log(postData.authorName);

            // Handle anonymity for discussions
            if (activeTab === 'discussions' && role === 'student' && isAnonymous) {
                postData.authorName = 'Anonymous Student';
                postData.isAnonymous = true;
            } else {
                postData.authorName = authorName;
                postData.isAnonymous = false;
            }

            await addDoc(collection(db, 'courses', courseId as string, collectionName), postData);

            setNewTitle('');
            setNewContent('');
            setIsAnonymous(false);
            setShowCreateForm(false);
            Alert.alert('Success', `${activeTab === 'announcements' ? 'Announcement' : 'Discussion'} created!`);
        } catch (error) {
            console.error('Error creating post:', error);
            Alert.alert('Error', 'Failed to create post. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    };

    const handleDiscussionPress = (discussion: Discussion) => {
        router.push({
            pathname: '/discussion-detail',
            params: {
                courseId: courseId,
                discussionId: discussion.id,
                discussionTitle: discussion.title,
                courseName: courseName,
                role: role
            }
        });
    };

    const renderAnnouncements = () => (
        <ScrollView style={styles.contentContainer}>
            {announcements.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No announcements yet</Text>
                </View>
            ) : (
                announcements.map((announcement) => (
                    <View key={announcement.id} style={styles.postCard}>
                        <View style={styles.postHeader}>
                            <Text style={styles.postTitle}>{announcement.title}</Text>
                            <View style={[
                                styles.roleTag,
                                announcement.authorRole === 'teacher' ? styles.teacherTag : styles.studentTag
                            ]}>
                                <Text style={styles.roleTagText}>{announcement.authorRole}</Text>
                            </View>
                        </View>
                        <Text style={styles.postContent}>{announcement.content}</Text>
                        <View style={styles.postMeta}>
                            <Text style={styles.postAuthor}>By {announcement.authorName}</Text>
                            <Text style={styles.postDate}>{formatDate(announcement.createdAt)}</Text>
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );

    const renderDiscussions = () => (
        <ScrollView style={styles.contentContainer}>
            {discussions.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No discussions yet</Text>
                </View>
            ) : (
                discussions.map((discussion) => (
                    <TouchableOpacity
                        key={discussion.id}
                        style={styles.postCard}
                        onPress={() => handleDiscussionPress(discussion)}
                    >
                        <View style={styles.postHeader}>
                            <Text style={styles.postTitle}>{discussion.title}</Text>
                            <View style={[
                                styles.roleTag,
                                discussion.isAnonymous ? styles.studentTag :
                                    discussion.authorRole === 'teacher' ? styles.teacherTag : styles.studentTag
                            ]}>
                                <Text style={styles.roleTagText}>
                                    {discussion.authorRole}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.postContent}>{discussion.content}</Text>
                        <View style={styles.postMeta}>
                            <Text style={styles.postAuthor}>By {discussion.authorName}</Text>
                            <Text style={styles.postDate}>{formatDate(discussion.createdAt)}</Text>
                        </View>
                        <View style={styles.discussionFooter}>
                            <Text style={styles.repliesCount}>
                                <Ionicons name="chatbubble-outline" size={14} color="#666" /> {discussion.replies} replies
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color="#666" />
                        </View>
                    </TouchableOpacity>
                ))
            )}
        </ScrollView>
    );

    const renderCreateForm = () => (
        <View style={styles.createFormContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.createForm}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.formHeader}>
                        <Text style={styles.formTitle}>Create {activeTab === 'announcements' ? 'Announcement' : 'Discussion'}</Text>
                        <TouchableOpacity onPress={() => setShowCreateForm(false)}>
                            <Ionicons name="close" size={24} color="#81171b" />
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.titleInput}
                        placeholder="Title"
                        value={newTitle}
                        onChangeText={setNewTitle}
                        placeholderTextColor="#666"
                    />

                    <TextInput
                        style={styles.contentInput}
                        placeholder="Content"
                        value={newContent}
                        onChangeText={setNewContent}
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        placeholderTextColor="#666"
                    />

                    {/* Anonymity option for students creating discussions */}
                    {activeTab === 'discussions' && role === 'student' && (
                        <View style={styles.anonymityOption}>
                            <Text style={styles.anonymityLabel}>Post anonymously</Text>
                            <Switch
                                value={isAnonymous}
                                onValueChange={setIsAnonymous}
                                trackColor={{ false: '#e0e0e0', true: '#81171b' }}
                                thumbColor={isAnonymous ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.createButton, loading && styles.buttonDisabled]}
                        onPress={handleCreate}
                        disabled={loading}
                    >
                        <Text style={styles.createButtonText}>
                            {loading ? 'Creating...' : 'Create'}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#81171b" />
                </Pressable>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{courseName}</Text>
                    <Text style={styles.headerSubtitle}>{courseCode} • {instructorName}</Text>
                </View>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'announcements' && styles.activeTab]}
                    onPress={() => setActiveTab('announcements')}
                >
                    <Text style={[styles.tabText, activeTab === 'announcements' && styles.activeTabText]}>
                        Announcements
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'discussions' && styles.activeTab]}
                    onPress={() => setActiveTab('discussions')}
                >
                    <Text style={[styles.tabText, activeTab === 'discussions' && styles.activeTabText]}>
                        Discussions
                    </Text>
                </TouchableOpacity>
            </View>

            {showCreateForm ? renderCreateForm() : (
                <>
                    {activeTab === 'announcements' ? renderAnnouncements() : renderDiscussions()}

                    {/* Only teachers can create announcements, both can create discussions */}
                    {(activeTab === 'discussions' || role === 'teacher') && (
                        <TouchableOpacity
                            style={styles.fab}
                            onPress={() => setShowCreateForm(true)}
                        >
                            <Ionicons name="add" size={30} color="#fff" />
                        </TouchableOpacity>
                    )}
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        marginRight: 15,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
    },
    tab: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: '#81171b',
    },
    tabText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#fff',
    },
    contentContainer: {
        flex: 1,
        padding: 15,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
    },
    postCard: {
        backgroundColor: '#f8f8f8',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    postTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    postContent: {
        fontSize: 16,
        color: '#555',
        lineHeight: 22,
        marginBottom: 10,
    },
    postMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    postAuthor: {
        fontSize: 12,
        color: '#81171b',
        fontWeight: '500',
    },
    postDate: {
        fontSize: 12,
        color: '#666',
    },
    roleTag: {
        backgroundColor: '#81171b',
        padding: 5,
        borderRadius: 5,
    },
    teacherTag: {
        backgroundColor: '#81171b',
    },
    studentTag: {
        backgroundColor: '#2196F3',
    },
    anonymousTag: {
        backgroundColor: '#666',
    },
    roleTagText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
    },
    discussionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 5,
    },
    repliesCount: {
        fontSize: 12,
        color: '#666',
    },
    createFormContainer: {
        flex: 1,
    },
    createForm: {
        flex: 1,
        padding: 20,
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    formTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    titleInput: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        fontSize: 16,
        marginBottom: 15,
    },
    contentInput: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        fontSize: 16,
        minHeight: 120,
        marginBottom: 20,
    },
    createButton: {
        backgroundColor: '#81171b',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    anonymityOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    anonymityLabel: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#81171b',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    formScrollView: {
        flex: 1,
    },
}); 