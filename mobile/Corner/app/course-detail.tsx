import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable, Switch, StatusBar, ActivityIndicator, Animated, PanResponder } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import firestore, { deleteField } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { notificationHelpers } from '../services/notificationHelpers';
import { offlineCacheService, CachedAnnouncement, CachedDiscussion } from '../services/offlineCache';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { draftManager, DraftPost } from '../services/draftManager';
import ConnectivityIndicator from '../components/ConnectivityIndicator';
import CustomAlert from '../components/CustomAlert';
import RichTextEditor from '../components/RichTextEditor';
import MarkdownRenderer from '../components/MarkdownRenderer';

// Custom Action Menu Component
const ActionMenu = ({ visible, onClose, onEdit, onDelete, itemTitle }: {
    visible: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    itemTitle: string;
}) => {
    if (!visible) return null;

    return (
        <View style={styles.actionMenuOverlay}>
            <TouchableOpacity style={styles.actionMenuBackdrop} onPress={onClose} />
            <View style={styles.actionMenu}>
                <View style={styles.actionMenuHeader}>
                    <Text style={styles.actionMenuTitle}>{itemTitle}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.actionMenuClose}>
                        <Ionicons name="close" size={20} color="#64748b" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.actionMenuItem} onPress={onEdit}>
                    <Ionicons name="pencil" size={20} color="#4f46e5" />
                    <Text style={styles.actionMenuText}>Edit</Text>
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e0" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionMenuItem, styles.actionMenuItemDanger]} onPress={onDelete}>
                    <Ionicons name="trash" size={20} color="#ef4444" />
                    <Text style={[styles.actionMenuText, styles.actionMenuTextDanger]}>Delete</Text>
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e0" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// Skeleton Loader Components
const SkeletonCard = () => (
    <View style={styles.skeletonCard}>
        <View style={styles.skeletonHeader}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonTag} />
        </View>
        <View style={styles.skeletonContent}>
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, { width: '80%' }]} />
            <View style={[styles.skeletonLine, { width: '60%' }]} />
        </View>
        <View style={styles.skeletonFooter}>
            <View style={styles.skeletonMeta} />
            <View style={styles.skeletonMeta} />
        </View>
    </View>
);

const LoadingSpinner = () => (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading content...</Text>
    </View>
);

interface Announcement {
    id: string;
    title: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
    authorId: string;
    views?: { [userId: string]: any }; // Track who viewed the announcement and when
}

interface Discussion {
    id: string;
    title: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
    replies: number;
    authorId: string;
    isAnonymous?: boolean;
    likes?: { [userId: string]: any }; // Track who liked the discussion and when
}

interface CourseConversation {
    id: string;
    otherUserId: string;
    otherUserName: string;
    otherUserRole: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
}

export default function CourseDetailScreen() {
    const params = useLocalSearchParams();
    const { courseId, courseName, courseCode, instructorName, role, isArchived } = params;
    const { isOnline, hasReconnected } = useNetworkStatus();
    const insets = useSafeAreaInsets();

    // Check if course is archived
    const courseIsArchived = isArchived === 'true';

    const [activeTab, setActiveTab] = useState<'announcements' | 'discussions' | 'inbox'>('announcements');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [discussions, setDiscussions] = useState<Discussion[]>([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newContentHtml, setNewContentHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: string, type: 'announcement' | 'discussion', title: string, content: string } | null>(null);
    const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
    const [drafts, setDrafts] = useState<DraftPost[]>([]);
    const [syncingDrafts, setSyncingDrafts] = useState(false);
    const [expandedAnnouncements, setExpandedAnnouncements] = useState<{ [key: string]: boolean }>({});
    const [expandedDiscussions, setExpandedDiscussions] = useState<{ [key: string]: boolean }>({});
    const [alertConfig, setAlertConfig] = useState<any>(null);
    const [courseConversations, setCourseConversations] = useState<CourseConversation[]>([]);
    const [loadingInbox, setLoadingInbox] = useState(false);
    const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
    const [actionMenuVisible, setActionMenuVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<{ id: string, type: 'announcement' | 'discussion', title: string } | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(true);
    const fadeAnim = new Animated.Value(1); // Start visible instead of invisible

    // Track if Firebase listeners are already set up
    const listenersSetupRef = useRef(false);
    const fadeAnimRef = useRef(1); // Start at 1 to match

    // Convert plain text to HTML for RichTextEditor
    const handleContentChange = (html: string) => {
        try {
            setNewContentHtml(html);
            // Use the HTML content directly for storage to preserve formatting
            setNewContent(html);
        } catch (error) {
            console.error('📝 CourseDetail: Error in handleContentChange:', error);
        }
    };

    // Initialize cache on component mount
    useEffect(() => {
        offlineCacheService.initializeCache();
        loadDrafts();
    }, []);

    // Load cached data when offline or sync when reconnected
    useEffect(() => {
        if (!courseId) return;

        if (isOnline) {
            // Online: Use Firebase listeners and cache the data
            setupFirebaseListeners();
            // Sync drafts when coming back online
            if (hasReconnected) {
                syncDrafts();
            }
        } else {
            // Offline: Load cached data
            loadCachedData();
        }

        // Sync when reconnected
        if (hasReconnected && courseId) {
            syncDataAfterReconnection();
        }
    }, [courseId, isOnline, hasReconnected]);

    // Refresh data when screen comes back into focus
    useFocusEffect(
        React.useCallback(() => {
            refreshData();
            if (!courseId) return;

            // Force refresh data when screen comes into focus
            if (isOnline) {
                setupFirebaseListeners();
            } else {
                loadCachedData();
            }

            // Refresh drafts
            loadDrafts();

            // Refresh inbox if it's the active tab
            if (activeTab === 'inbox') {
                loadCourseConversations();
            }
        }, [courseId, isOnline, activeTab])
    );

    // Load course conversations when inbox tab is active
    useEffect(() => {
        if (activeTab === 'inbox' && courseId) {
            loadCourseConversations();
        }
    }, [activeTab, courseId]);

    // Animate content fade in when loading completes
    useEffect(() => {
        if (!isLoadingContent) {
            // Ensure content is fully visible when not loading
            fadeAnim.setValue(1);
            fadeAnimRef.current = 1;
        } else {
            fadeAnim.setValue(0);
            fadeAnimRef.current = 0;
        }
    }, [isLoadingContent]);

    // Animate content fade in when switching tabs (but not when closing modal)
    useEffect(() => {
        if (!isLoadingContent && !showCreateForm) {
            // Ensure content is visible when switching tabs
            fadeAnim.setValue(1);
            fadeAnimRef.current = 1;
        }
    }, [activeTab, isLoadingContent, showCreateForm]);

    // Animate content fade in when modal is closed
    useEffect(() => {
        if (!showCreateForm && !isLoadingContent) {
            // Ensure content is visible when modal is closed
            fadeAnim.setValue(1);
            fadeAnimRef.current = 1;
        }
    }, [showCreateForm, isLoadingContent]);

    // Reset listeners setup flag when courseId changes
    useEffect(() => {
        listenersSetupRef.current = false;
    }, [courseId]);

    const loadCourseConversations = async () => {
        try {
            setLoadingInbox(true);
            const user = auth().currentUser;
            if (!user) return;

            // Get all messages related to this course where user is either sender or receiver
            const sentMessagesQuery = await firestore()
                .collection('messages')
                .where('senderId', '==', user.uid)
                .where('courseId', '==', courseId)
                .orderBy('timestamp', 'desc')
                .get();

            const receivedMessagesQuery = await firestore()
                .collection('messages')
                .where('receiverId', '==', user.uid)
                .where('courseId', '==', courseId)
                .orderBy('timestamp', 'desc')
                .get();

            // Combine and group messages by conversation
            const conversationMap = new Map<string, CourseConversation>();

            // Process sent messages
            for (const messageDoc of sentMessagesQuery.docs) {
                const messageData = messageDoc.data();
                const otherUserId = messageData.receiverId;
                const conversationId = otherUserId;

                if (!conversationMap.has(conversationId)) {
                    // Get other user info
                    let otherUserName = 'Unknown';
                    let otherUserRole = 'student';

                    try {
                        const otherUserDoc = await firestore().collection('users').doc(otherUserId).get();
                        if (otherUserDoc.exists()) {
                            const otherUserData = otherUserDoc.data();
                            otherUserName = otherUserData?.name || 'Unknown';
                            otherUserRole = otherUserData?.role || 'student';
                        }
                    } catch (error) {
                        console.error('Error fetching other user info:', error);
                    }

                    conversationMap.set(conversationId, {
                        id: conversationId,
                        otherUserId: otherUserId,
                        otherUserName: otherUserName,
                        otherUserRole: otherUserRole,
                        lastMessage: messageData.content,
                        lastMessageTime: messageData.timestamp,
                        unreadCount: 0 // Sent messages are not unread
                    });
                } else {
                    const conversation = conversationMap.get(conversationId)!;
                    if (new Date(messageData.timestamp) > new Date(conversation.lastMessageTime)) {
                        conversation.lastMessage = messageData.content;
                        conversation.lastMessageTime = messageData.timestamp;
                    }
                }
            }

            // Process received messages
            for (const messageDoc of receivedMessagesQuery.docs) {
                const messageData = messageDoc.data();
                const otherUserId = messageData.senderId;
                const conversationId = otherUserId;

                if (!conversationMap.has(conversationId)) {
                    // Get other user info
                    let otherUserName = 'Unknown';
                    let otherUserRole = 'student';

                    try {
                        const otherUserDoc = await firestore().collection('users').doc(otherUserId).get();
                        if (otherUserDoc.exists()) {
                            const otherUserData = otherUserDoc.data();
                            otherUserName = otherUserData?.name || 'Unknown';
                            otherUserRole = otherUserData?.role || 'student';
                        }
                    } catch (error) {
                        console.error('Error fetching other user info:', error);
                    }

                    conversationMap.set(conversationId, {
                        id: conversationId,
                        otherUserId: otherUserId,
                        otherUserName: otherUserName,
                        otherUserRole: otherUserRole,
                        lastMessage: messageData.content,
                        lastMessageTime: messageData.timestamp,
                        unreadCount: messageData.read ? 0 : 1
                    });
                } else {
                    const conversation = conversationMap.get(conversationId)!;
                    if (new Date(messageData.timestamp) > new Date(conversation.lastMessageTime)) {
                        conversation.lastMessage = messageData.content;
                        conversation.lastMessageTime = messageData.timestamp;
                        if (!messageData.read) {
                            conversation.unreadCount += 1;
                        }
                    }
                }
            }

            // Convert to array and sort by last message time
            const conversationsList = Array.from(conversationMap.values())
                .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

            setCourseConversations(conversationsList);

            // Reset unread count when inbox is viewed
            setInboxUnreadCount(0);
        } catch (error) {
            console.error('Error loading course conversations:', error);
        } finally {
            setLoadingInbox(false);
        }
    };

    const loadDrafts = async () => {
        if (!courseId) return;
        try {
            const courseDrafts = await draftManager.getDraftsByCourse(courseId as string);
            setDrafts(courseDrafts);
        } catch (error) {
            console.error('Error loading drafts:', error);
        }
    };

    const syncDrafts = async () => {
        if (!courseId) return;

        setSyncingDrafts(true);
        try {
            const result = await draftManager.syncAllDrafts();
            if (result.syncedCount > 0) {
                setAlertConfig({
                    visible: true,
                    title: 'Drafts Synced',
                    message: `Successfully synced ${result.syncedCount} draft${result.syncedCount > 1 ? 's' : ''}.`,
                    type: 'success',
                    actions: [
                        {
                            text: 'OK',
                            onPress: () => setAlertConfig(null),
                            style: 'primary',
                        },
                    ],
                });
            }

            if (result.failedCount > 0) {
                setAlertConfig({
                    visible: true,
                    title: 'Sync Issues',
                    message: `${result.failedCount} draft${result.failedCount > 1 ? 's' : ''} failed to sync. They will be retried later.`,
                    type: 'warning',
                    actions: [
                        {
                            text: 'OK',
                            onPress: () => setAlertConfig(null),
                            style: 'primary',
                        },
                    ],
                });
            }

            await loadDrafts(); // Refresh drafts list
        } catch (error) {
            console.error('Error syncing drafts:', error);
        } finally {
            setSyncingDrafts(false);
        }
    };

    const setupFirebaseListeners = () => {
        if (!courseId) return;

        // Prevent duplicate listener setup
        if (listenersSetupRef.current) {
            return;
        }

        listenersSetupRef.current = true;

        // Only set loading state if we don't have any content yet
        if (announcements.length === 0 && discussions.length === 0) {
            setIsLoadingContent(true);
        }

        let announcementsLoaded = false;
        let discussionsLoaded = false;

        const checkIfAllLoaded = () => {
            if (announcementsLoaded && discussionsLoaded) {
                setIsLoadingContent(false);
            }
        };

        // Add a timeout fallback in case listeners don't fire
        const loadingTimeout = setTimeout(() => {
            setIsLoadingContent(false);
        }, 10000); // 10 second timeout

        // Listen to announcements
        const announcementsQuery = firestore().collection('courses').doc(courseId as string).collection('announcements').orderBy('createdAt', 'desc');

        const unsubscribeAnnouncements = announcementsQuery.onSnapshot(async (snapshot) => {
            const announcementsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Announcement[];

            setAnnouncements(announcementsList);

            // Cache the announcements when online
            try {
                await offlineCacheService.cacheAnnouncements(
                    courseId as string,
                    announcementsList,
                    courseName as string
                );
            } catch (error) {
                console.error('Error caching announcements:', error);
            }

            announcementsLoaded = true;
            checkIfAllLoaded();
        }, (error) => {
            console.error('Error in announcements listener:', error);
            announcementsLoaded = true;
            checkIfAllLoaded();
        });

        // Listen to discussions and cache them
        const discussionsQuery = firestore().collection('courses').doc(courseId as string).collection('discussions').orderBy('createdAt', 'desc');

        const unsubscribeDiscussions = discussionsQuery.onSnapshot(async (snapshot) => {
            const discussionsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Discussion[];

            setDiscussions(discussionsList);

            // Cache the discussions when online
            try {
                await offlineCacheService.cacheDiscussions(
                    courseId as string,
                    discussionsList,
                    courseName as string
                );
            } catch (error) {
                console.error('Error caching discussions:', error);
            }

            discussionsLoaded = true;
            checkIfAllLoaded();
        }, (error) => {
            console.error('Error in discussions listener:', error);
            discussionsLoaded = true;
            checkIfAllLoaded();
        });

        // Listen to unread messages for inbox badge count
        const user = auth().currentUser;
        if (user) {
            const unreadMessagesQuery = firestore()
                .collection('messages')
                .where('receiverId', '==', user.uid)
                .where('courseId', '==', courseId)
                .where('read', '==', false);

            const unsubscribeUnreadMessages = unreadMessagesQuery.onSnapshot((snapshot) => {
                setInboxUnreadCount(snapshot.docs.length);
            });

            return () => {
                clearTimeout(loadingTimeout);
                unsubscribeAnnouncements();
                unsubscribeDiscussions();
                unsubscribeUnreadMessages();
            };
        }

        return () => {
            clearTimeout(loadingTimeout);
            unsubscribeAnnouncements();
            unsubscribeDiscussions();
        };
    };

    const loadCachedData = async () => {
        if (!courseId) return;

        setIsLoadingFromCache(true);
        setIsLoadingContent(true);
        try {
            const [cachedAnnouncements, cachedDiscussions] = await Promise.all([
                offlineCacheService.getCachedAnnouncements(courseId as string),
                offlineCacheService.getCachedDiscussions(courseId as string)
            ]);

            setAnnouncements(cachedAnnouncements as Announcement[]);
            setDiscussions(cachedDiscussions as Discussion[]);
        } catch (error) {
            console.error('Error loading cached data:', error);
        } finally {
            setIsLoadingFromCache(false);
            setIsLoadingContent(false);
        }
    };

    const syncDataAfterReconnection = async () => {
        if (!courseId || !courseName) return;

        try {
            await Promise.all([
                offlineCacheService.syncAnnouncementsFromFirebase(
                    courseId as string,
                    courseName as string
                ),
                offlineCacheService.syncDiscussionsFromFirebase(
                    courseId as string,
                    courseName as string
                )
            ]);
            await offlineCacheService.updateLastSyncTime();
        } catch (error) {
            console.error('Error syncing data after reconnection:', error);
        }
    };

    const handleCreate = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Please fill in both title and content.',
                type: 'error',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
            return;
        }

        // If editing, use update function instead
        if (editingItem) {
            return handleUpdate();
        }

        // If offline, save as draft
        if (!isOnline) {
            return handleSaveDraft();
        }

        setLoading(true);
        try {
            const user = auth().currentUser;
            if (!user) {
                setAlertConfig({
                    visible: true,
                    title: 'Error',
                    message: 'You must be logged in.',
                    type: 'error',
                    actions: [
                        {
                            text: 'OK',
                            onPress: () => setAlertConfig(null),
                            style: 'primary',
                        },
                    ],
                });
                return;
            }

            // Get author name based on role
            let authorName: string;
            if (role === 'teacher') {
                // Use the instructorName passed as parameter
                authorName = instructorName as string;
            } else {
                // For students, fetch name from Firestore
                const userDoc = await firestore().collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                authorName = userData?.name || 'Anonymous';
            }

            const collectionName = activeTab;
            const postData: any = {
                title: newTitle.trim(),
                content: newContent.trim(),
                createdAt: firestore.FieldValue.serverTimestamp(),
                authorRole: role,
                authorId: user.uid,
                replies: 0
            };

            postData.authorName = authorName;

            // Handle anonymity for discussions
            if (activeTab === 'discussions' && role === 'student' && isAnonymous) {
                postData.authorName = 'Anonymous Student';
                postData.isAnonymous = true;
            } else {
                postData.authorName = authorName;
                postData.isAnonymous = false;
            }

            const docRef = await firestore().collection('courses').doc(courseId as string).collection(collectionName).add(postData);

            // Trigger notifications based on content type
            try {
                if (activeTab === 'announcements' && (role === 'teacher' || role === 'admin')) {
                    // Notify students of new announcement (teachers and admins only)
                    const announcementData = {
                        id: docRef.id,
                        title: newTitle.trim(),
                        content: newContent.trim(),
                        authorName: authorName
                    };
                    await notificationHelpers.notifyStudentsOfAnnouncement(courseId as string, announcementData, user.uid);
                } else if (activeTab === 'discussions') {
                    // Check for discussion milestone (every 10 posts)
                    await notificationHelpers.checkDiscussionMilestone(courseId as string, user.uid);
                }
            } catch (notificationError) {
                console.error('Error sending notifications:', notificationError);
                // Don't fail the main operation if notifications fail
            }

            setNewTitle('');
            setNewContent('');
            setNewContentHtml('');
            setIsAnonymous(false);
            setShowCreateForm(false);

            // Force refresh the data to ensure new content appears
            await refreshData();

            setAlertConfig({
                visible: true,
                title: 'Success',
                message: `${activeTab === 'announcements' ? 'Announcement' : 'Discussion'} created!`,
                type: 'success',
                actions: [
                    {
                        text: 'OK',
                        onPress: async () => {
                            setAlertConfig(null);
                            await refreshData();
                            setShowCreateForm(false);
                        },
                        style: 'primary',
                    },
                ],
            });
        } catch (error) {
            console.error('Error creating post:', error);
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to create post. Please try again.',
                type: 'error',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        try {
            if (activeTab === 'announcements') {
                setAlertConfig({
                    visible: true,
                    title: 'Offline',
                    message: 'Announcements cannot be drafted offline. Please try when online.',
                    type: 'warning',
                    actions: [
                        {
                            text: 'OK',
                            onPress: () => setAlertConfig(null),
                            style: 'primary',
                        },
                    ],
                });
                return;
            }

            const draftData = {
                type: 'discussion' as const,
                title: newTitle.trim(),
                content: newContent.trim(),
                courseId: courseId as string,
                isAnonymous: isAnonymous,
                authorRole: role as string,
                instructorName: instructorName as string
            };

            const draftId = await draftManager.saveDraft(draftData);

            setNewTitle('');
            setNewContent('');
            setNewContentHtml('');
            setIsAnonymous(false);
            setShowCreateForm(false);

            await loadDrafts(); // Refresh drafts list

            setAlertConfig({
                visible: true,
                title: 'Draft Saved',
                message: 'Your discussion has been saved as a draft and will be posted when you go back online.',
                type: 'success',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
        } catch (error) {
            console.error('Error saving draft:', error);
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to save draft. Please try again.',
                type: 'error',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
        }
    };

    const handleDelete = async (itemId: string, type: 'announcement' | 'discussion') => {
        setAlertConfig({
            visible: true,
            title: 'Delete',
            message: `Are you sure you want to delete this ${type}?`,
            type: 'warning',
            actions: [
                {
                    text: 'Cancel',
                    onPress: () => setAlertConfig(null),
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    onPress: async () => {
                        setAlertConfig(null);
                        try {
                            await firestore().collection('courses').doc(courseId as string).collection(`${type}s`).doc(itemId).delete();

                            // Force refresh the data to ensure deleted content is removed
                            await refreshData();

                            setAlertConfig({
                                visible: true,
                                title: 'Success',
                                message: `${type} deleted successfully`,
                                type: 'success',
                                actions: [
                                    {
                                        text: 'OK',
                                        onPress: () => setAlertConfig(null),
                                        style: 'primary',
                                    },
                                ],
                            });
                        } catch (error) {
                            console.error('Error deleting:', error);
                            setAlertConfig({
                                visible: true,
                                title: 'Error',
                                message: 'Failed to delete. Please try again.',
                                type: 'error',
                                actions: [
                                    {
                                        text: 'OK',
                                        onPress: () => setAlertConfig(null),
                                        style: 'primary',
                                    },
                                ],
                            });
                        }
                    },
                    style: 'destructive',
                },
            ],
        });
    };

    const handleEdit = (item: any, type: 'announcement' | 'discussion') => {
        setEditingItem({
            id: item.id,
            type: type,
            title: item.title,
            content: item.content
        });
        setNewTitle(item.title);
        setNewContent(item.content);
        setNewContentHtml(item.content); // Initialize RichTextEditor with existing content
        setShowCreateForm(true);
    };

    const handleActionMenu = (item: any, type: 'announcement' | 'discussion') => {
        setSelectedItem({
            id: item.id,
            type: type,
            title: item.title
        });
        setActionMenuVisible(true);
    };

    const handleCloseActionMenu = () => {
        setActionMenuVisible(false);
        setSelectedItem(null);
    };

    const handleEditFromMenu = () => {
        if (selectedItem) {
            const item = selectedItem.type === 'announcement'
                ? announcements.find(a => a.id === selectedItem.id)
                : discussions.find(d => d.id === selectedItem.id);

            if (item) {
                handleCloseActionMenu();
                handleEdit(item, selectedItem.type);
            }
        }
    };

    const handleDeleteFromMenu = () => {
        if (selectedItem) {
            handleCloseActionMenu();
            handleDelete(selectedItem.id, selectedItem.type);
        }
    };

    const handleUpdate = async () => {
        if (!editingItem || !newTitle.trim() || !newContent.trim()) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Please fill in both title and content.',
                type: 'error',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
            return;
        }

        setLoading(true);
        try {
            const collectionName = `${editingItem.type}s`;
            await firestore().collection('courses').doc(courseId as string).collection(collectionName).doc(editingItem.id).update({
                title: newTitle.trim(),
                content: newContent.trim(),
                updatedAt: firestore.FieldValue.serverTimestamp()
            });

            setNewTitle('');
            setNewContent('');
            setEditingItem(null);
            setShowCreateForm(false);

            // Force refresh the data to ensure updated content appears
            await refreshData();

            setAlertConfig({
                visible: true,
                title: 'Success',
                message: `${editingItem.type} updated successfully!`,
                type: 'success',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
        } catch (error) {
            console.error('Error updating:', error);
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to update. Please try again.',
                type: 'error',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setNewTitle('');
        setNewContent('');
        setNewContentHtml('');
        setEditingItem(null);
        setIsAnonymous(false);
        setShowCreateForm(false);
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

    const handleAnnouncementPress = async (announcement: Announcement) => {
        // Record view when announcement is pressed
        await recordAnnouncementView(announcement.id);

        // Toggle expansion using proper state update
        const wasExpanded = expandedAnnouncements[announcement.id];

        if (wasExpanded) {
            setExpandedAnnouncements(prev => {
                const newSet = { ...prev };
                delete newSet[announcement.id];
                return newSet;
            });
        } else {
            setExpandedAnnouncements(prev => {
                const newSet = { ...prev };
                newSet[announcement.id] = true;
                return newSet;
            });
        }
    };

    const handleAnnouncementReadMore = async (announcement: Announcement) => {
        // Record view when read more is clicked
        await recordAnnouncementView(announcement.id);

        setExpandedAnnouncements(prev => {
            const newSet = { ...prev };
            newSet[announcement.id] = true;
            return newSet;
        });
    };

    const handleAnnouncementReadLess = (announcement: Announcement) => {
        setExpandedAnnouncements(prev => {
            const newSet = { ...prev };
            delete newSet[announcement.id];
            return newSet;
        });
    };

    const handleDiscussionPress = (discussion: Discussion) => {
        // Toggle expansion using proper state update
        const wasExpanded = expandedDiscussions[discussion.id];

        if (wasExpanded) {
            setExpandedDiscussions(prev => {
                const newSet = { ...prev };
                delete newSet[discussion.id];
                return newSet;
            });
        } else {
            setExpandedDiscussions(prev => {
                const newSet = { ...prev };
                newSet[discussion.id] = true;
                return newSet;
            });
        }
    };

    const handleDiscussionReadMore = (discussion: Discussion) => {
        setExpandedDiscussions(prev => {
            const newSet = { ...prev };
            newSet[discussion.id] = true;
            return newSet;
        });
    };

    const handleDiscussionReadLess = (discussion: Discussion) => {
        setExpandedDiscussions(prev => {
            const newSet = { ...prev };
            delete newSet[discussion.id];
            return newSet;
        });
    };

    const handleDiscussionNavigation = (discussion: Discussion) => {
        router.push({
            pathname: '/discussion-detail',
            params: {
                courseId: courseId,
                discussionId: discussion.id,
                discussionTitle: discussion.title,
                courseName: courseName,
                role: role,
                isArchived: courseIsArchived ? 'true' : 'false'
            }
        });
    };

    const recordAnnouncementView = async (announcementId: string) => {
        if (!auth().currentUser || !courseId) return;

        try {
            // Use a separate Firebase instance to avoid interfering with listeners
            const announcementRef = firestore().collection('courses').doc(courseId as string).collection('announcements').doc(announcementId);

            // Use a transaction to avoid race conditions
            await firestore().runTransaction(async (transaction) => {
                const announcementDoc = await transaction.get(announcementRef);

                if (announcementDoc.exists()) {
                    const views = announcementDoc.data()?.views || {};
                    // Only record view if user hasn't viewed it before
                    if (!views[auth().currentUser?.uid || '']) {
                        transaction.update(announcementRef, {
                            [`views.${auth().currentUser?.uid}`]: firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Error recording announcement view:', error);
        }
    };

    const handleLikeDiscussion = async (discussionId: string) => {
        if (!auth().currentUser || !courseId) return;

        try {
            const discussionRef = firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId);
            const discussionDoc = await discussionRef.get();

            if (discussionDoc.exists()) {
                const likes = discussionDoc.data()?.likes || {};
                const hasLiked = likes[auth().currentUser?.uid || ''];

                if (hasLiked) {
                    // Unlike
                    await discussionRef.update({
                        [`likes.${auth().currentUser?.uid}`]: deleteField()
                    });
                } else {
                    // Like
                    await discussionRef.update({
                        [`likes.${auth().currentUser?.uid}`]: firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        } catch (error) {
            console.error('Error toggling discussion like:', error);
        }
    };

    const getAnnouncementPreview = (content: string, maxLength: number = 100) => {
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    };

    const getDiscussionPreview = (content: string, maxLength: number = 100) => {
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    };

    const renderAnnouncements = () => (
        <ScrollView style={styles.contentContainer}>
            {/* Offline/Cache Status Indicator */}
            {(!isOnline || isLoadingFromCache) && (
                <View style={styles.offlineIndicator}>
                    <Ionicons
                        name={!isOnline ? "cloud-offline" : "refresh"}
                        size={16}
                        color={!isOnline ? "#f59e0b" : "#4f46e5"}
                    />
                    <Text style={styles.offlineText}>
                        {!isOnline ? "Offline - Showing cached content" : "Loading cached content..."}
                    </Text>
                </View>
            )}

            {/* Loading State */}
            {isLoadingContent ? (
                <View>
                    <LoadingSpinner />
                    {/* Show skeleton cards while loading */}
                    {[1, 2, 3].map((index) => (
                        <SkeletonCard key={index} />
                    ))}
                </View>
            ) : announcements.length === 0 ? (
                <Animated.View style={{ opacity: fadeAnim }}>
                    <View style={styles.emptyState}>
                        <Ionicons name="megaphone-outline" size={64} color="#cbd5e0" />
                        <Text style={styles.emptyText}>
                            {!isOnline ? "No cached announcements available" : "No announcements yet"}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {!isOnline ? "Check back when you're online" : "Be the first to create an announcement"}
                        </Text>
                    </View>
                </Animated.View>
            ) : (
                <Animated.View style={{ opacity: fadeAnim }}>
                    {announcements.map((announcement) => (
                        <TouchableOpacity
                            key={announcement.id}
                            style={styles.postCard}
                            onPress={() => handleAnnouncementPress(announcement)}
                            activeOpacity={0.95}
                        >
                            <View style={styles.postHeader}>
                                <Text style={styles.postTitle}>{announcement.title}</Text>
                                <View style={styles.postHeaderRight}>
                                    <View style={[
                                        styles.roleTag,
                                        announcement.authorRole === 'teacher' ? styles.teacherTag :
                                            announcement.authorRole === 'admin' ? styles.adminTag : styles.studentTag
                                    ]}>
                                        <Text style={styles.roleTagText}>{announcement.authorRole}</Text>
                                    </View>
                                    {/* Show edit/delete only for author and if not archived and online */}
                                    {auth().currentUser?.uid === announcement.authorId && !courseIsArchived && isOnline && (
                                        <TouchableOpacity
                                            style={styles.actionMenuButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleActionMenu(announcement, 'announcement');
                                            }}
                                        >
                                            <Ionicons name="ellipsis-horizontal" size={20} color="#64748b" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <View style={styles.postContentContainer}>
                                <MarkdownRenderer
                                    content={
                                        expandedAnnouncements[announcement.id]
                                            ? announcement.content
                                            : getAnnouncementPreview(announcement.content)
                                    }
                                />
                            </View>

                            {/* Show "read more" button if content is truncated and not expanded */}
                            {announcement.content.length > 100 && !expandedAnnouncements[announcement.id] && (
                                <TouchableOpacity
                                    style={styles.readMoreButton}
                                    onPress={() => handleAnnouncementReadMore(announcement)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.readMoreText}>Read more</Text>
                                    <Ionicons name="chevron-down" size={16} color="#4f46e5" />
                                </TouchableOpacity>
                            )}

                            {/* Show "read less" button if expanded */}
                            {expandedAnnouncements[announcement.id] && (
                                <TouchableOpacity
                                    style={styles.readMoreButton}
                                    onPress={() => handleAnnouncementReadLess(announcement)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.readMoreText}>Read less</Text>
                                    <Ionicons name="chevron-up" size={16} color="#4f46e5" />
                                </TouchableOpacity>
                            )}

                            {/* Unread indicator - only show for students, not for the author */}
                            {!announcement.views?.[auth().currentUser?.uid || ''] &&
                                auth().currentUser?.uid !== announcement.authorId && (
                                    <View style={styles.unreadIndicator}>
                                        <View style={styles.unreadDot} />
                                        <Text style={styles.unreadText}>New</Text>
                                    </View>
                                )}

                            <View style={styles.postMeta}>
                                <Text style={styles.postAuthor}>By {announcement.authorName}</Text>
                                <Text style={styles.postDate}>{formatDate(announcement.createdAt)}</Text>
                            </View>
                            <View style={styles.viewCount}>
                                <Ionicons name="eye-outline" size={16} color="#64748b" />
                                <Text style={styles.viewCountText}>
                                    {announcement.views ? Object.keys(announcement.views).length : 0} views
                                </Text>
                            </View>
                            {courseIsArchived && (
                                <View style={styles.archivedNotice}>
                                    <Ionicons name="archive" size={14} color="#666" />
                                    <Text style={styles.archivedNoticeText}>This course is archived - read only</Text>
                                </View>
                            )}
                            {!isOnline && (
                                <View style={styles.cachedIndicator}>
                                    <Ionicons name="download" size={12} color="#4f46e5" />
                                    <Text style={styles.cachedText}>Cached content</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </Animated.View>
            )}
        </ScrollView>
    );

    const renderDiscussions = () => {
        return (
            <ScrollView style={styles.contentContainer}>
                {/* Offline/Cache Status Indicator */}
                {(!isOnline || isLoadingFromCache) && (
                    <View style={styles.offlineIndicator}>
                        <Ionicons
                            name={!isOnline ? "cloud-offline" : "refresh"}
                            size={16}
                            color={!isOnline ? "#f59e0b" : "#4f46e5"}
                        />
                        <Text style={styles.offlineText}>
                            {!isOnline ? "Offline - Showing cached discussions" : "Loading cached discussions..."}
                        </Text>
                    </View>
                )}

                {/* Draft Sync Status */}
                {syncingDrafts && (
                    <View style={styles.syncIndicator}>
                        <Ionicons name="sync" size={16} color="#4f46e5" />
                        <Text style={styles.syncText}>Syncing drafts...</Text>
                    </View>
                )}

                {/* Manual Sync Button */}
                {isOnline && drafts.filter(d => d.type === 'discussion' && (d.status === 'draft' || d.status === 'failed')).length > 0 && (
                    <TouchableOpacity
                        style={styles.manualSyncButton}
                        onPress={syncDrafts}
                        disabled={syncingDrafts}
                    >
                        <Ionicons
                            name={syncingDrafts ? "sync" : "cloud-upload"}
                            size={16}
                            color="#4f46e5"
                        />
                        <Text style={styles.manualSyncText}>
                            {syncingDrafts ? 'Syncing...' : 'Sync Drafts'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Draft Posts (Pending/Failed) */}
                {drafts.filter(draft => draft.type === 'discussion' && (draft.status === 'draft' || draft.status === 'failed' || draft.status === 'pending')).map((draft) => (
                    <View key={draft.id} style={[styles.postCard, styles.draftCard]}>
                        <View style={styles.postHeader}>
                            <Text style={styles.postTitle}>{draft.title}</Text>
                            <View style={styles.postHeaderRight}>
                                <View style={[styles.statusBadge,
                                draft.status === 'pending' ? styles.pendingBadge :
                                    draft.status === 'failed' ? styles.failedBadge : styles.draftBadge
                                ]}>
                                    <Ionicons
                                        name={
                                            draft.status === 'pending' ? "sync" :
                                                draft.status === 'failed' ? "alert-circle" : "document-text"
                                        }
                                        size={12}
                                        color="#fff"
                                    />
                                    <Text style={styles.statusBadgeText}>
                                        {draft.status === 'pending' ? 'Syncing' :
                                            draft.status === 'failed' ? 'Failed' : 'Draft'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <Text style={styles.postContent}>{draft.content}</Text>
                        <View style={styles.postMeta}>
                            <Text style={styles.postAuthor}>
                                {draft.isAnonymous ? 'Anonymous Student' : `By ${draft.authorRole}`}
                            </Text>
                            <Text style={styles.postDate}>
                                {new Date(draft.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                        {draft.status === 'failed' && (
                            <View style={styles.errorNotice}>
                                <Ionicons name="warning" size={14} color="#ef4444" />
                                <Text style={styles.errorNoticeText}>
                                    Failed to sync. Will retry when online.
                                </Text>
                            </View>
                        )}
                    </View>
                ))}

                {/* Loading State */}
                {isLoadingContent ? (
                    <View>
                        <LoadingSpinner />
                        {/* Show skeleton cards while loading */}
                        {[1, 2, 3].map((index) => (
                            <SkeletonCard key={index} />
                        ))}
                    </View>
                ) : discussions.length === 0 && drafts.filter(d => d.type === 'discussion').length === 0 ? (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        <View style={styles.emptyState}>
                            <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e0" />
                            <Text style={styles.emptyText}>
                                {!isOnline ? "No cached discussions available" : "No discussions yet"}
                            </Text>
                            <Text style={styles.emptySubtext}>
                                {!isOnline ? "Check back when you're online" : "Start the first discussion"}
                            </Text>
                        </View>
                    </Animated.View>
                ) : (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        {discussions.map((discussion) => (
                            <TouchableOpacity
                                key={discussion.id}
                                style={styles.postCard}
                                onPress={() => handleDiscussionNavigation(discussion)}
                                activeOpacity={0.95}
                            >
                                <View style={styles.postHeader}>
                                    <Text style={styles.postTitle}>{discussion.title}</Text>
                                    <View style={styles.postHeaderRight}>
                                        <View style={[
                                            styles.roleTag,
                                            discussion.isAnonymous ? styles.studentTag :
                                                discussion.authorRole === 'teacher' ? styles.teacherTag :
                                                    discussion.authorRole === 'admin' ? styles.adminTag : styles.studentTag
                                        ]}>
                                            <Text style={styles.roleTagText}>
                                                {discussion.authorRole}
                                            </Text>
                                        </View>
                                        {/* Show edit/delete only for author and if not archived and online */}
                                        {auth().currentUser?.uid === discussion.authorId && !courseIsArchived && isOnline && (
                                            <TouchableOpacity
                                                style={styles.actionMenuButton}
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    handleActionMenu(discussion, 'discussion');
                                                }}
                                            >
                                                <Ionicons name="ellipsis-horizontal" size={20} color="#64748b" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.postContentContainer}>
                                    <MarkdownRenderer
                                        content={
                                            expandedDiscussions[discussion.id]
                                                ? discussion.content
                                                : getDiscussionPreview(discussion.content)
                                        }
                                    />
                                </View>

                                {/* Show "read more" button if content is truncated and not expanded */}
                                {discussion.content.length > 100 && !expandedDiscussions[discussion.id] && (
                                    <TouchableOpacity
                                        style={styles.readMoreIndicator}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleDiscussionReadMore(discussion);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="chevron-down" size={16} color="#4f46e5" />
                                        <Text style={styles.readMoreText}>Read more</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Show "read less" button if expanded */}
                                {expandedDiscussions[discussion.id] && (
                                    <TouchableOpacity
                                        style={styles.readMoreIndicator}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleDiscussionReadLess(discussion);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="chevron-up" size={16} color="#4f46e5" />
                                        <Text style={styles.readMoreText}>Read less</Text>
                                    </TouchableOpacity>
                                )}

                                <View style={styles.postMeta}>
                                    <Text style={styles.postAuthor}>By {discussion.authorName}</Text>
                                    <Text style={styles.postDate}>{formatDate(discussion.createdAt)}</Text>
                                </View>
                                <View style={styles.discussionFooter}>
                                    <View style={styles.discussionStats}>
                                        <TouchableOpacity
                                            style={styles.likeButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleLikeDiscussion(discussion.id);
                                            }}
                                        >
                                            <Ionicons
                                                name={discussion.likes?.[auth().currentUser?.uid || ''] ? "thumbs-up" : "thumbs-up-outline"}
                                                size={16}
                                                color={discussion.likes?.[auth().currentUser?.uid || ''] ? "#4f46e5" : "#64748b"}
                                            />
                                            <Text style={styles.likeCount}>
                                                {discussion.likes ? Object.keys(discussion.likes).length : 0}
                                            </Text>
                                        </TouchableOpacity>
                                        <Text style={styles.repliesCount}>
                                            <Ionicons name="chatbubble-outline" size={14} color="#666" /> {discussion.replies} replies
                                        </Text>
                                    </View>
                                </View>
                                {courseIsArchived && (
                                    <View style={styles.archivedNotice}>
                                        <Ionicons name="archive" size={14} color="#666" />
                                        <Text style={styles.archivedNoticeText}>This course is archived - read only</Text>
                                    </View>
                                )}
                                {!isOnline && (
                                    <View style={styles.cachedIndicator}>
                                        <Ionicons name="download" size={12} color="#4f46e5" />
                                        <Text style={styles.cachedText}>Cached content</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                )}
            </ScrollView>
        );
    };

    const renderCreateForm = () => {
        return (
            <View style={styles.createFormContainer}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoidingView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={[
                            styles.scrollContent,
                            { paddingBottom: Math.max(100, insets.bottom + 20) }
                        ]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                    >
                        <View style={styles.formHeader}>
                            <Text style={styles.formTitle}>
                                {editingItem ? `Edit ${editingItem.type}` : `Create ${activeTab === 'announcements' ? 'Announcement' : 'Discussion'}`}
                            </Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => {
                                    setShowCreateForm(false);
                                    resetForm();
                                }}
                            >
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formContent}>
                            <TextInput
                                style={styles.titleInput}
                                value={newTitle}
                                onChangeText={setNewTitle}
                                placeholder={`${activeTab === 'announcements' ? 'Announcement' : 'Discussion'} title`}
                                placeholderTextColor="#666"
                            />

                            <RichTextEditor
                                value={newContentHtml}
                                onChange={handleContentChange}
                                placeholder="Write your content here..."
                                style={styles.contentInput}
                            />

                            {/* Anonymity option for students creating discussions */}
                            {activeTab === 'discussions' && role === 'student' && (
                                <View style={styles.anonymityOption}>
                                    <Text style={styles.anonymityLabel}>Post anonymously</Text>
                                    <Switch
                                        value={isAnonymous}
                                        onValueChange={setIsAnonymous}
                                        trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
                                        thumbColor={isAnonymous ? '#fff' : '#f4f3f4'}
                                    />
                                </View>
                            )}

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={[styles.createButton, loading && styles.buttonDisabled]}
                                    onPress={handleCreate}
                                    disabled={loading}
                                >
                                    <Text style={styles.createButtonText}>
                                        {loading ? (editingItem ? 'Updating...' : 'Creating...') : (editingItem ? 'Update' : 'Create')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        );
    };

    const renderInbox = () => {
        const handleConversationPress = (conversation: CourseConversation) => {
            router.push({
                pathname: '/course-conversation',
                params: {
                    courseId: courseId as string,
                    courseName: courseName as string,
                    otherUserId: conversation.otherUserId,
                    otherUserName: conversation.otherUserName,
                    otherUserRole: conversation.otherUserRole
                }
            });
        };

        const handleNewMessage = () => {
            router.push({
                pathname: '/course-compose-message',
                params: {
                    courseId: courseId as string,
                    courseName: courseName as string,
                    role: role as string
                }
            });
        };

        const formatTimestamp = (timestamp: string) => {
            const date = new Date(timestamp);
            const now = new Date();
            const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

            if (diffInHours < 24) {
                return date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            } else if (diffInHours < 48) {
                return 'Yesterday';
            } else {
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            }
        };

        const getInitials = (name: string) => {
            const nameParts = name.trim().split(' ');
            if (nameParts.length >= 2) {
                return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
            } else {
                return name.substring(0, 2).toUpperCase();
            }
        };

        return (
            <View style={styles.contentContainer}>
                {loadingInbox ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color="#4f46e5" />
                        <Text style={styles.emptyText}>Loading conversations...</Text>
                    </View>
                ) : courseConversations.length > 0 ? (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {courseConversations.map((conversation) => (
                            <TouchableOpacity
                                key={conversation.id}
                                style={styles.conversationCard}
                                onPress={() => handleConversationPress(conversation)}
                            >
                                <View style={styles.conversationHeader}>
                                    <View style={styles.userInfo}>
                                        <View style={styles.avatar}>
                                            <Text style={styles.avatarText}>
                                                {getInitials(conversation.otherUserName)}
                                            </Text>
                                        </View>
                                        <View style={styles.userDetails}>
                                            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
                                                {conversation.otherUserName}
                                            </Text>
                                            <Text style={styles.userRole}>
                                                {conversation.otherUserRole === 'teacher' ? 'Teacher' : 'Student'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.messageMeta}>
                                        <Text style={styles.timestamp}>
                                            {formatTimestamp(conversation.lastMessageTime)}
                                        </Text>
                                        {conversation.unreadCount > 0 && (
                                            <View style={styles.unreadBadge}>
                                                <Text style={styles.unreadCount}>{conversation.unreadCount}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Text style={styles.lastMessage} numberOfLines={2}>
                                    {conversation.lastMessage}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e0" />
                        <Text style={styles.emptyText}>No conversations yet</Text>
                        <Text style={styles.emptySubtext}>
                            Start a conversation with someone in this course.
                        </Text>
                    </View>
                )}

                {/* New Message Button */}
                {!courseIsArchived && (
                    <TouchableOpacity
                        style={styles.newMessageButton}
                        onPress={handleNewMessage}
                    >
                        <Ionicons name="create" size={20} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const refreshData = async () => {
        if (!courseId || !isOnline) return;

        try {
            // Fetch fresh data directly without setting up new listeners
            const [announcementsSnapshot, discussionsSnapshot] = await Promise.all([
                firestore().collection('courses').doc(courseId as string).collection('announcements').orderBy('createdAt', 'desc').get(),
                firestore().collection('courses').doc(courseId as string).collection('discussions').orderBy('createdAt', 'desc').get()
            ]);

            const announcementsList = announcementsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Announcement[];

            const discussionsList = discussionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Discussion[];

            setAnnouncements(announcementsList);
            setDiscussions(discussionsList);

            // Cache the data
            try {
                await Promise.all([
                    offlineCacheService.cacheAnnouncements(courseId as string, announcementsList, courseName as string),
                    offlineCacheService.cacheDiscussions(courseId as string, discussionsList, courseName as string)
                ]);
            } catch (error) {
                console.error('Error caching refreshed data:', error);
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
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
                        <Text style={styles.headerTitle}>{courseName}</Text>
                        <Text style={styles.headerSubtitle}>{courseCode}</Text>
                    </View>
                    <View style={styles.headerActions}>
                        {role === 'teacher' && (
                            <TouchableOpacity
                                style={styles.aiAssistantButton}
                                onPress={() => router.push({
                                    pathname: '/ai-assistant',
                                    params: { courseId, courseName, role }
                                })}
                            >
                                <Ionicons name="sparkles" size={20} color="#fff" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.resourcesButton}
                            onPress={() => router.push({
                                pathname: '/course-resources',
                                params: { courseId, courseName, role }
                            })}
                        >
                            <Ionicons name="folder" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'announcements' && styles.activeTab]}
                    onPress={() => setActiveTab('announcements')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.tabText, activeTab === 'announcements' && styles.activeTabText]}>
                        Announcements
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'discussions' && styles.activeTab]}
                    onPress={() => setActiveTab('discussions')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.tabText, activeTab === 'discussions' && styles.activeTabText]}>
                        Discussions
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'inbox' && styles.activeTab]}
                    onPress={() => setActiveTab('inbox')}
                    activeOpacity={0.7}
                >
                    <View style={styles.tabContent}>
                        <Text style={[styles.tabText, activeTab === 'inbox' && styles.activeTabText]}>
                            Inbox
                        </Text>
                        {inboxUnreadCount > 0 && (
                            <View style={[styles.tabBadge, activeTab === 'inbox' && styles.activeTabBadge]}>
                                <Text style={[styles.tabBadgeText, activeTab === 'inbox' && styles.activeTabBadgeText]}>
                                    {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                                </Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            {showCreateForm ? renderCreateForm() : (
                <>
                    {activeTab === 'announcements' ? renderAnnouncements() :
                        activeTab === 'discussions' ? renderDiscussions() :
                            activeTab === 'inbox' ? renderInbox() : null}

                    {/* Only show FAB if not archived and user can create content, but not on inbox tab */}
                    {!courseIsArchived && activeTab !== 'inbox' && (
                        (role === 'teacher' || role === 'admin') ||
                        (role === 'student' && activeTab === 'discussions')
                    ) && (
                            <TouchableOpacity
                                style={[styles.fab, { bottom: Math.max(24, insets.bottom + 8) }]}
                                onPress={() => setShowCreateForm(true)}
                            >
                                <Ionicons name="add" size={30} color="#fff" />
                            </TouchableOpacity>
                        )}
                </>
            )}

            <CustomAlert
                visible={alertConfig?.visible || false}
                title={alertConfig?.title || ''}
                message={alertConfig?.message || ''}
                type={alertConfig?.type || 'info'}
                actions={alertConfig?.actions || []}
                onDismiss={() => setAlertConfig(null)}
            />

            <ActionMenu
                visible={actionMenuVisible}
                onClose={handleCloseActionMenu}
                onEdit={handleEditFromMenu}
                onDelete={handleDeleteFromMenu}
                itemTitle={selectedItem?.title || ''}
            />
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
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'transparent',
        marginRight: 16,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    archivedBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginLeft: 12,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 4,
        fontWeight: '500',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 0,
        backgroundColor: '#e2e8f0',
        borderRadius: 12,
        marginHorizontal: 4,
        marginTop: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    activeTab: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    tabText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    activeTabText: {
        color: '#fff',
        fontWeight: '700',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 20,
        paddingBottom: 100, // Add extra padding for FAB
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 120,
    },
    emptyText: {
        fontSize: 18,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    postCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    draftCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.02)',
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    postTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        letterSpacing: -0.3,
        lineHeight: 26,
    },
    postContent: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
        marginBottom: 20,
    },
    postContentContainer: {
        marginBottom: 20,
        paddingVertical: 4,
    },
    postMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    postAuthor: {
        fontSize: 14,
        color: '#4f46e5',
        fontWeight: '600',
    },
    postDate: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
    },
    roleTag: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    teacherTag: {
        backgroundColor: '#d44500',
    },
    adminTag: {
        backgroundColor: '#059669',
    },
    studentTag: {
        backgroundColor: '#0891b2',
    },
    anonymousTag: {
        backgroundColor: '#64748b',
    },
    roleTagText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    discussionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    repliesCount: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    createFormContainer: {
        flex: 1,
        backgroundColor: '#f1f5f9',
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
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingHorizontal: 16,
    },
    formTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        letterSpacing: -0.3,
        flex: 1,
    },
    formContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    titleInput: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        color: '#1e293b',
        fontWeight: '500',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        minHeight: 50,
    },
    contentInput: {
        marginBottom: 20,
        minHeight: 120,
    },
    createButton: {
        backgroundColor: '#4f46e5',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        alignSelf: 'center',
        width: '100%',
        maxWidth: 300,
        minHeight: 50,
    },
    buttonDisabled: {
        opacity: 0.6,
        shadowOpacity: 0.1,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    anonymityOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    anonymityLabel: {
        fontSize: 15,
        color: '#1e293b',
        fontWeight: '600',
        flex: 1,
    },
    fab: {
        position: 'absolute',
        right: 24,
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#4f46e5',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        zIndex: 1000,
        // Ensure FAB is always visible
        minWidth: 68,
        minHeight: 68,
    },
    formScrollView: {
        flex: 1,
    },
    postHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    archivedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
    },
    archivedNoticeText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 6,
        fontWeight: '500',
    },
    aiAssistantButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    resourcesButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginBottom: 20,
    },
    offlineText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
        fontWeight: '500',
    },
    cachedIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginTop: 20,
    },
    cachedText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
        fontWeight: '500',
    },
    syncIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginBottom: 20,
    },
    syncText: {
        fontSize: 14,
        color: '#64748b',
        marginLeft: 8,
        fontWeight: '500',
    },
    statusBadge: {
        backgroundColor: '#4f46e5',
        padding: 8,
        borderRadius: 8,
    },
    statusBadgeText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '700',
    },
    pendingBadge: {
        backgroundColor: '#f59e0b',
    },
    failedBadge: {
        backgroundColor: '#ef4444',
    },
    draftBadge: {
        backgroundColor: '#059669',
    },
    errorNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 8,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
    },
    errorNoticeText: {
        fontSize: 12,
        color: '#ef4444',
        marginLeft: 6,
        fontWeight: '500',
    },
    connectivityIndicator: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
    },
    viewCount: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    viewCountText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    discussionStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    likeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
    },
    likeCount: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    readMoreIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        marginBottom: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    readMoreText: {
        fontSize: 14,
        color: '#4f46e5',
        fontWeight: '600',
        marginLeft: 6,
        letterSpacing: 0.3,
    },
    unreadIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 6,
        backgroundColor: '#fef3c7',
        borderRadius: 8,
        gap: 6,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    unreadDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#f59e0b',
    },
    unreadText: {
        fontSize: 12,
        color: '#92400e',
        fontWeight: '600',
    },
    manualSyncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    manualSyncText: {
        marginLeft: 8,
        color: '#4f46e5',
        fontSize: 15,
        fontWeight: '600',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: 10,
    },
    closeButton: {
        padding: 8,
    },
    buttonContainer: {
        marginTop: 8,
    },
    conversationCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        marginRight: 8,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    userDetails: {
        flex: 1,
        minWidth: 0,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
    },
    userRole: {
        fontSize: 13,
        color: '#64748b',
    },
    messageMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    timestamp: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
        textAlign: 'right',
    },
    unreadBadge: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    unreadCount: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    lastMessage: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
    },
    newMessageButton: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 12,
        shadowColor: '#4f46e5',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        flexDirection: 'row',
    },
    newMessageButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    tabContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    activeTabBadge: {
        backgroundColor: '#fff',
    },
    tabBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    activeTabBadgeText: {
        color: '#ef4444',
    },
    actionMenuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
    },
    actionMenuBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    actionMenu: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '80%',
        maxWidth: 350,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    actionMenuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    actionMenuTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        letterSpacing: -0.3,
    },
    actionMenuClose: {
        padding: 8,
    },
    actionMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    actionMenuItemDanger: {
        borderBottomColor: '#fef2f2',
    },
    actionMenuText: {
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '600',
        marginLeft: 12,
    },
    actionMenuTextDanger: {
        color: '#ef4444',
    },
    actionMenuButton: {
        padding: 8,
    },
    skeletonCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    skeletonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    skeletonTitle: {
        width: '70%',
        height: 24,
        backgroundColor: '#e0e0e0',
        borderRadius: 8,
    },
    skeletonTag: {
        width: 60,
        height: 20,
        backgroundColor: '#e0e0e0',
        borderRadius: 8,
    },
    skeletonContent: {
        marginBottom: 20,
        paddingVertical: 4,
    },
    skeletonLine: {
        height: 18,
        backgroundColor: '#e0e0e0',
        borderRadius: 8,
        marginBottom: 10,
    },
    skeletonFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    skeletonMeta: {
        width: 40,
        height: 16,
        backgroundColor: '#e0e0e0',
        borderRadius: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 120,
    },
    loadingText: {
        fontSize: 18,
        color: '#64748b',
        marginTop: 10,
    },
    viewDiscussionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    viewDiscussionText: {
        color: '#4f46e5',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    readMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        marginBottom: 4,
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        minWidth: 120,
    },

}); 