import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable, Switch, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../config/ firebase-config';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { notificationHelpers } from '../services/notificationHelpers';
import { offlineCacheService, CachedAnnouncement, CachedDiscussion } from '../services/offlineCache';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { draftManager, DraftPost } from '../services/draftManager';
import ConnectivityIndicator from '../components/ConnectivityIndicator';

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
    const [loading, setLoading] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [editingItem, setEditingItem] = useState<{ id: string, type: 'announcement' | 'discussion', title: string, content: string } | null>(null);
    const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
    const [drafts, setDrafts] = useState<DraftPost[]>([]);
    const [syncingDrafts, setSyncingDrafts] = useState(false);
    const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<string>>(new Set());
    const textInputRef = useRef<TextInput>(null);
    const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });

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
                Alert.alert(
                    'Drafts Synced',
                    `Successfully synced ${result.syncedCount} draft${result.syncedCount > 1 ? 's' : ''}.`,
                    [{ text: 'OK' }]
                );
            }

            if (result.failedCount > 0) {
                Alert.alert(
                    'Sync Issues',
                    `${result.failedCount} draft${result.failedCount > 1 ? 's' : ''} failed to sync. They will be retried later.`,
                    [{ text: 'OK' }]
                );
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
        const announcementsQuery = query(
            collection(db, 'courses', courseId as string, 'announcements'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeAnnouncements = onSnapshot(announcementsQuery, async (snapshot) => {
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
        const discussionsQuery = query(
            collection(db, 'courses', courseId as string, 'discussions'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeDiscussions = onSnapshot(discussionsQuery, async (snapshot) => {
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

            if (cachedAnnouncements.length > 0 || cachedDiscussions.length > 0) {
                console.log(`Loaded ${cachedAnnouncements.length} announcements and ${cachedDiscussions.length} discussions from cache`);
            }
        } catch (error) {
            console.error('Error loading cached data:', error);
        } finally {
            setIsLoadingFromCache(false);
        }
    };

    const syncDataAfterReconnection = async () => {
        if (!courseId || !courseName) return;

        try {
            console.log('Syncing data after reconnection...');
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
            Alert.alert('Error', 'Please fill in both title and content.');
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

            // Handle anonymity for discussions
            if (activeTab === 'discussions' && role === 'student' && isAnonymous) {
                postData.authorName = 'Anonymous Student';
                postData.isAnonymous = true;
            } else {
                postData.authorName = authorName;
                postData.isAnonymous = false;
            }

            const docRef = await addDoc(collection(db, 'courses', courseId as string, collectionName), postData);

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

    const handleSaveDraft = async () => {
        try {
            if (activeTab === 'announcements') {
                Alert.alert('Offline', 'Announcements cannot be drafted offline. Please try when online.');
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
            setIsAnonymous(false);
            setShowCreateForm(false);

            await loadDrafts(); // Refresh drafts list

            Alert.alert(
                'Draft Saved',
                'Your discussion has been saved as a draft and will be posted when you go back online.',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error saving draft:', error);
            Alert.alert('Error', 'Failed to save draft. Please try again.');
        }
    };

    const handleDelete = async (itemId: string, type: 'announcement' | 'discussion') => {
        Alert.alert(
            'Delete',
            `Are you sure you want to delete this ${type}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'courses', courseId as string, `${type}s`, itemId));
                            Alert.alert('Success', `${type} deleted successfully`);
                        } catch (error) {
                            console.error('Error deleting:', error);
                            Alert.alert('Error', 'Failed to delete. Please try again.');
                        }
                    }
                }
            ]
        );
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
        setShowCreateForm(true);
    };

    const handleUpdate = async () => {
        if (!editingItem || !newTitle.trim() || !newContent.trim()) {
            Alert.alert('Error', 'Please fill in both title and content.');
            return;
        }

        setLoading(true);
        try {
            const collectionName = `${editingItem.type}s`;
            await updateDoc(doc(db, 'courses', courseId as string, collectionName, editingItem.id), {
                title: newTitle.trim(),
                content: newContent.trim(),
                updatedAt: serverTimestamp()
            });

            setNewTitle('');
            setNewContent('');
            setEditingItem(null);
            setShowCreateForm(false);
            Alert.alert('Success', `${editingItem.type} updated successfully!`);
        } catch (error) {
            console.error('Error updating:', error);
            Alert.alert('Error', 'Failed to update. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setNewTitle('');
        setNewContent('');
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
        if (!auth.currentUser || !courseId) return;

        try {
            const announcementRef = doc(db, 'courses', courseId as string, 'announcements', announcementId);
            const announcementDoc = await getDoc(announcementRef);

            if (announcementDoc.exists()) {
                const views = announcementDoc.data().views || {};
                // Only record view if user hasn't viewed it before
                if (!views[auth.currentUser.uid]) {
                    await updateDoc(announcementRef, {
                        [`views.${auth.currentUser.uid}`]: serverTimestamp()
                    });
                }
            }
        } catch (error) {
            console.error('Error recording announcement view:', error);
        }
    };

    const handleLikeDiscussion = async (discussionId: string) => {
        if (!auth.currentUser || !courseId) return;

        try {
            const discussionRef = doc(db, 'courses', courseId as string, 'discussions', discussionId);
            const discussionDoc = await getDoc(discussionRef);

            if (discussionDoc.exists()) {
                const likes = discussionDoc.data().likes || {};
                const hasLiked = likes[auth.currentUser.uid];

                if (hasLiked) {
                    // Unlike
                    await updateDoc(discussionRef, {
                        [`likes.${auth.currentUser.uid}`]: deleteField()
                    });
                } else {
                    // Like
                    await updateDoc(discussionRef, {
                        [`likes.${auth.currentUser.uid}`]: serverTimestamp()
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

    // Formatting functions
    const applyFormatting = (prefix: string, suffix: string = '') => {
        if (!textInputRef.current) return;

        const currentText = newContent;
        const { start, end } = selection;

        // If text is selected, wrap it with formatting
        if (start !== end) {
            const selectedText = currentText.substring(start, end);
            const newText =
                currentText.substring(0, start) +
                prefix + selectedText + suffix +
                currentText.substring(end);
            setNewContent(newText);

            // Set cursor position after the formatted text
            setTimeout(() => {
                if (textInputRef.current) {
                    textInputRef.current.focus();
                    textInputRef.current.setNativeProps({
                        selection: {
                            start: start + prefix.length,
                            end: start + prefix.length + selectedText.length
                        }
                    });
                }
            }, 50);
        } else {
            // No selection - insert formatting markers at cursor
            const newText =
                currentText.substring(0, start) +
                prefix + suffix +
                currentText.substring(start);
            setNewContent(newText);

            // Position cursor between the markers
            setTimeout(() => {
                if (textInputRef.current) {
                    textInputRef.current.focus();
                    textInputRef.current.setNativeProps({
                        selection: {
                            start: start + prefix.length,
                            end: start + prefix.length
                        }
                    });
                }
            }, 50);
        }
    };

    const toggleFormattingToolbar = () => {
        setShowFormattingToolbar(!showFormattingToolbar);
    };

    // MarkdownText component to render formatted text
    const MarkdownText = ({ text, style }: { text: string; style?: any }) => {
        if (!text) return null;

        const parts = [];
        let currentIndex = 0;

        // Bold: **text**
        const boldRegex = /\*\*(.*?)\*\*/g;
        let boldMatch;
        while ((boldMatch = boldRegex.exec(text)) !== null) {
            // Add text before the match
            if (boldMatch.index > currentIndex) {
                parts.push(
                    <Text key={`text-${currentIndex}`} style={style}>
                        {text.slice(currentIndex, boldMatch.index)}
                    </Text>
                );
            }

            // Add bold text
            parts.push(
                <Text key={`bold-${currentIndex}`} style={[style, { fontWeight: 'bold' }]}>
                    {boldMatch[1]}
                </Text>
            );

            currentIndex = boldMatch.index + boldMatch[0].length;
        }

        // Italic: *text*
        const italicRegex = /\*(.*?)\*/g;
        let italicMatch;
        while ((italicMatch = italicRegex.exec(text)) !== null) {
            // Add text before the match
            if (italicMatch.index > currentIndex) {
                parts.push(
                    <Text key={`text-${currentIndex}`} style={style}>
                        {text.slice(currentIndex, italicMatch.index)}
                    </Text>
                );
            }

            // Add italic text
            parts.push(
                <Text key={`italic-${currentIndex}`} style={[style, { fontStyle: 'italic' }]}>
                    {italicMatch[1]}
                </Text>
            );

            currentIndex = italicMatch.index + italicMatch[0].length;
        }

        // Strikethrough: ~~text~~
        const strikeRegex = /~~(.*?)~~/g;
        let strikeMatch;
        while ((strikeMatch = strikeRegex.exec(text)) !== null) {
            // Add text before the match
            if (strikeMatch.index > currentIndex) {
                parts.push(
                    <Text key={`text-${currentIndex}`} style={style}>
                        {text.slice(currentIndex, strikeMatch.index)}
                    </Text>
                );
            }

            // Add strikethrough text
            parts.push(
                <Text key={`strike-${currentIndex}`} style={[style, { textDecorationLine: 'line-through' }]}>
                    {strikeMatch[1]}
                </Text>
            );

            currentIndex = strikeMatch.index + strikeMatch[0].length;
        }

        // Code: `text`
        const codeRegex = /`(.*?)`/g;
        let codeMatch;
        while ((codeMatch = codeRegex.exec(text)) !== null) {
            // Add text before the match
            if (codeMatch.index > currentIndex) {
                parts.push(
                    <Text key={`text-${currentIndex}`} style={style}>
                        {text.slice(currentIndex, codeMatch.index)}
                    </Text>
                );
            }

            // Add code text
            parts.push(
                <Text key={`code-${currentIndex}`} style={[style, { fontFamily: 'monospace', backgroundColor: '#f1f5f9', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }]}>
                    {codeMatch[1]}
                </Text>
            );

            currentIndex = codeMatch.index + codeMatch[0].length;
        }

        // Add remaining text
        if (currentIndex < text.length) {
            parts.push(
                <Text key={`text-${currentIndex}`} style={style}>
                    {text.slice(currentIndex)}
                </Text>
            );
        }

        // If no formatting found, return plain text
        if (parts.length === 0) {
            return <Text style={style}>{text}</Text>;
        }

        return <Text>{parts}</Text>;
    };

    // Formatting toolbar component
    const FormattingToolbar = () => (
        <View style={styles.toolbarContainer}>
            <View style={styles.formattingRow}>
                <TouchableOpacity
                    style={styles.formattingButton}
                    onPress={() => applyFormatting('**', '**')}
                >
                    <Text style={{ fontWeight: 'bold' }}>B</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.formattingButton}
                    onPress={() => applyFormatting('*', '*')}
                >
                    <Text style={{ fontStyle: 'italic' }}>I</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.formattingButton}
                    onPress={() => applyFormatting('~~', '~~')}
                >
                    <Text style={{ textDecorationLine: 'line-through' }}>S</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.formattingButton}
                    onPress={() => applyFormatting('`', '`')}
                >
                    <Text style={{ fontFamily: 'monospace' }}>{'</>'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.formattingButton}
                    onPress={() => applyFormatting('\n- ', '')}
                >
                    <Text>•</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.formattingButton}
                    onPress={() => applyFormatting('\n1. ', '')}
                >
                    <Text>1.</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.formattingButton}
                    onPress={() => applyFormatting('[', '](url)')}
                >
                    <Text>🔗</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                style={styles.closeToolbarButton}
                onPress={() => setShowFormattingToolbar(false)}
            >
                <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>
        </View>
    );

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
                                {auth.currentUser?.uid === announcement.authorId && !courseIsArchived && isOnline && (
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
                        <Text style={styles.postContent}>
                            {expandedAnnouncements.has(announcement.id)
                                ? announcement.content
                                : getAnnouncementPreview(announcement.content)
                            }
                        </Text>

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

                        {/* Unread indicator */}
                        {!announcement.views?.[auth.currentUser?.uid || ''] && (
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
                                {auth.currentUser?.uid === discussion.authorId && !courseIsArchived && isOnline && (
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
                        <MarkdownText text={discussion.content} style={styles.postContent} />
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
                                        name={discussion.likes?.[auth.currentUser?.uid || ''] ? "thumbs-up" : "thumbs-up-outline"}
                                        size={16}
                                        color={discussion.likes?.[auth.currentUser?.uid || ''] ? "#4f46e5" : "#64748b"}
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

    const renderCreateForm = () => (
        <View style={styles.createFormContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.createForm}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.formHeader}>
                        <Text style={styles.formTitle}>
                            {editingItem ? 'Edit' : 'Create'} {activeTab === 'announcements' ? 'Announcement' : 'Discussion'}
                        </Text>
                        <TouchableOpacity onPress={resetForm}>
                            <Ionicons name="close" size={24} color="#4f46e5" />
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.titleInput}
                        placeholder="Title"
                        value={newTitle}
                        onChangeText={setNewTitle}
                        placeholderTextColor="#666"
                    />

                    {/* Formatting toolbar toggle button - only for discussions */}
                    {activeTab === 'discussions' && (
                        <TouchableOpacity
                            style={styles.formattingToggleButton}
                            onPress={toggleFormattingToolbar}
                        >
                            <Ionicons
                                name={showFormattingToolbar ? "chevron-up" : "text"}
                                size={20}
                                color="#4f46e5"
                            />
                            <Text style={styles.formattingToggleText}>
                                {showFormattingToolbar ? "Hide formatting" : "Formatting"}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Formatting toolbar - only for discussions */}
                    {activeTab === 'discussions' && showFormattingToolbar && <FormattingToolbar />}

                    <TextInput
                        ref={textInputRef}
                        style={styles.contentInput}
                        placeholder="Content"
                        value={newContent}
                        onChangeText={setNewContent}
                        onSelectionChange={(e) => {
                            setSelection(e.nativeEvent.selection);
                        }}
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
                                trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
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
                            {loading ? (editingItem ? 'Updating...' : 'Creating...') : (editingItem ? 'Update' : 'Create')}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
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
        backgroundColor: '#f1f5f9',
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        backgroundColor: '#fff',
        borderBottomColor: '#4f46e5',
    },
    tabText: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    activeTabText: {
        color: '#4f46e5',
        fontWeight: '700',
    },
    contentContainer: {
        flex: 1,
        padding: 20,
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
    },
    formTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        letterSpacing: -0.3,
    },
    titleInput: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        fontSize: 17,
        marginBottom: 16,
        borderWidth: 2,
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
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        fontSize: 16,
        minHeight: 140,
        marginBottom: 24,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        color: '#1e293b',
        lineHeight: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    createButton: {
        backgroundColor: '#4f46e5',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
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
        marginBottom: 24,
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
        marginTop: 8,
        padding: 8,
        backgroundColor: '#fef3c7',
        borderRadius: 8,
        gap: 6,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#f59e0b',
    },
    unreadText: {
        fontSize: 12,
        color: '#92400e',
        fontWeight: '600',
    },
    toolbarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    formattingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    formattingButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    closeToolbarButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    formattingToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    formattingToggleText: {
        marginLeft: 8,
        color: '#4f46e5',
        fontWeight: '500',
    },
}); 