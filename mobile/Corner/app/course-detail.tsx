import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable, Switch, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import firestore, { deleteField } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { notificationHelpers } from '../services/notificationHelpers';
import { offlineCacheService, CachedAnnouncement, CachedDiscussion } from '../services/offlineCache';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { draftManager, DraftPost } from '../services/draftManager';
import ConnectivityIndicator from '../components/ConnectivityIndicator';
import CustomAlert from '../components/CustomAlert';
import RichTextEditor from '../components/RichTextEditor';
import MarkdownRenderer from '../components/MarkdownRenderer';

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

export default function CourseDetailScreen() {
    const params = useLocalSearchParams();
    const { courseId, courseName, courseCode, instructorName, role, isArchived } = params;
    const { isOnline, hasReconnected } = useNetworkStatus();

    // Check if course is archived
    const courseIsArchived = isArchived === 'true';

    const [activeTab, setActiveTab] = useState<'announcements' | 'discussions'>('announcements');
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
    const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<string>>(new Set());
    const [alertConfig, setAlertConfig] = useState<any>(null);

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
        });

        return () => {
            unsubscribeAnnouncements();
            unsubscribeDiscussions();
        };
    };

    const loadCachedData = async () => {
        if (!courseId) return;

        setIsLoadingFromCache(true);
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
            setAlertConfig({
                visible: true,
                title: 'Success',
                message: `${activeTab === 'announcements' ? 'Announcement' : 'Discussion'} created!`,
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

    const handleDiscussionPress = (discussion: Discussion) => {
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
            const announcementRef = firestore().collection('courses').doc(courseId as string).collection('announcements').doc(announcementId);
            const announcementDoc = await announcementRef.get();

            if (announcementDoc.exists()) {
                const views = announcementDoc.data()?.views || {};
                // Only record view if user hasn't viewed it before
                if (!views[auth().currentUser?.uid || '']) {
                    await announcementRef.update({
                        [`views.${auth().currentUser?.uid}`]: firestore.FieldValue.serverTimestamp()
                    });
                }
            }
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

    const handleAnnouncementPress = async (announcement: Announcement) => {
        // Record view if not already viewed
        await recordAnnouncementView(announcement.id);

        // Toggle expansion
        const newExpanded = new Set(expandedAnnouncements);
        if (newExpanded.has(announcement.id)) {
            newExpanded.delete(announcement.id);
        } else {
            newExpanded.add(announcement.id);
        }
        setExpandedAnnouncements(newExpanded);
    };

    const getAnnouncementPreview = (content: string, maxLength: number = 100) => {
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

            {announcements.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        {!isOnline ? "No cached announcements available" : "No announcements yet"}
                    </Text>
                </View>
            ) : (
                announcements.map((announcement) => (
                    <TouchableOpacity
                        key={announcement.id}
                        style={styles.postCard}
                        onPress={() => handleAnnouncementPress(announcement)}
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
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={styles.editButton}
                                            onPress={() => handleEdit(announcement, 'announcement')}
                                        >
                                            <Ionicons name="pencil" size={16} color="#666" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDelete(announcement.id, 'announcement')}
                                        >
                                            <Ionicons name="trash" size={16} color="#d32f2f" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View style={styles.postContentContainer}>
                            <MarkdownRenderer
                                content={
                                    expandedAnnouncements.has(announcement.id)
                                        ? announcement.content
                                        : getAnnouncementPreview(announcement.content)
                                }
                            />
                        </View>

                        {/* Show "read more" indicator if content is truncated and not expanded */}
                        {announcement.content.length > 100 && !expandedAnnouncements.has(announcement.id) && (
                            <View style={styles.readMoreIndicator}>
                                <Ionicons name="chevron-down" size={16} color="#4f46e5" />
                                <Text style={styles.readMoreText}>Read more</Text>
                            </View>
                        )}

                        {/* Show "read less" indicator if expanded */}
                        {expandedAnnouncements.has(announcement.id) && (
                            <View style={styles.readMoreIndicator}>
                                <Ionicons name="chevron-up" size={16} color="#4f46e5" />
                                <Text style={styles.readMoreText}>Read less</Text>
                            </View>
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
                ))
            )}
        </ScrollView>
    );

    const renderDiscussions = () => (
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

            {/* Regular Discussions */}
            {discussions.length === 0 && drafts.filter(d => d.type === 'discussion').length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        {!isOnline ? "No cached discussions available" : "No discussions yet"}
                    </Text>
                </View>
            ) : (
                discussions.map((discussion) => (
                    <TouchableOpacity
                        key={discussion.id}
                        style={styles.postCard}
                        onPress={() => !courseIsArchived && handleDiscussionPress(discussion)}
                        disabled={courseIsArchived}
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
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            style={styles.editButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleEdit(discussion, 'discussion');
                                            }}
                                        >
                                            <Ionicons name="pencil" size={16} color="#666" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleDelete(discussion.id, 'discussion');
                                            }}
                                        >
                                            <Ionicons name="trash" size={16} color="#d32f2f" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View style={styles.postContentContainer}>
                            <MarkdownRenderer content={discussion.content} />
                        </View>
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
                            {!courseIsArchived && <Ionicons name="chevron-forward" size={16} color="#666" />}
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
                ))
            )}
        </ScrollView>
    );

    const renderCreateForm = () => {
        return (
            <View style={styles.createFormContainer}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoidingView}
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
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
                    <View style={styles.headerTitleRow}>
                        <Text style={styles.headerTitle}>{courseName}</Text>
                        {courseIsArchived && (
                            <View style={styles.archivedBadge}>
                                <Ionicons name="archive" size={16} color="#fff" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.headerSubtitle}>{courseCode} • {instructorName}</Text>
                </View>
                <View style={styles.headerActions}>
                    <ConnectivityIndicator size="small" style={styles.connectivityIndicator} />
                    {role === 'teacher' && (
                        <TouchableOpacity
                            style={styles.resourcesButton}
                            onPress={() => router.push({
                                pathname: '/course-resources',
                                params: {
                                    courseId: courseId,
                                    courseName: courseName,
                                    role: role
                                }
                            })}
                        >
                            <Ionicons name="folder" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.aiAssistantButton}
                        onPress={() => router.push({
                            pathname: '/ai-assistant',
                            params: {
                                courseId: courseId,
                                courseName: courseName,
                                courseCode: courseCode,
                                instructorName: instructorName,
                                role: role
                            }
                        })}
                    >
                        <Ionicons name="sparkles" size={20} color="#fff" />
                    </TouchableOpacity>
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
            </View>

            {showCreateForm ? renderCreateForm() : (
                <>
                    {activeTab === 'announcements' ? renderAnnouncements() : renderDiscussions()}

                    {/* Only show FAB if not archived and user can create content */}
                    {!courseIsArchived && (activeTab === 'discussions' || role === 'teacher' || role === 'admin') && (
                        <TouchableOpacity
                            style={styles.fab}
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
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 0,
        backgroundColor: '#e2e8f0',
        borderRadius: 12,
        marginHorizontal: 6,
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
        fontSize: 15,
        color: '#64748b',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    activeTabText: {
        color: '#fff',
        fontWeight: '700',
    },
    contentContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 20,
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
        backgroundColor: '#4f46e5',
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
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingHorizontal: 16,
    },
    formTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        letterSpacing: -0.3,
    },
    formContent: {
        paddingHorizontal: 16,
    },
    titleInput: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        fontSize: 17,
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
    },
    contentInput: {
        marginBottom: 20,
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
        width: '80%',
        maxWidth: 300,
    },
    buttonDisabled: {
        opacity: 0.6,
        shadowOpacity: 0.1,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 17,
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
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '600',
    },
    fab: {
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
    },
    formScrollView: {
        flex: 1,
    },
    postHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    editButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    deleteButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
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
        marginTop: 8,
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        gap: 4,
    },
    readMoreText: {
        fontSize: 14,
        color: '#4f46e5',
        fontWeight: '500',
        marginLeft: 4,
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
    },
    closeButton: {
        padding: 8,
    },
    buttonContainer: {
        marginTop: 8,
    },
}); 