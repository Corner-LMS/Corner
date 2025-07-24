import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable, StatusBar, Switch, Keyboard, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import firestore, { serverTimestamp, increment } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { notificationHelpers } from '../services/notificationHelpers';
import { offlineCacheService, CachedComment } from '../services/offlineCache';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { draftManager, DraftPost } from '../services/draftManager';
import ConnectivityIndicator from '../components/ConnectivityIndicator';
import CustomAlert from '../components/CustomAlert';
import RichTextEditor from '../components/RichTextEditor';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface Comment {
    id: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
    authorId: string;
    isAnonymous?: boolean;
    parentId?: string; // For nested replies
    replies?: Comment[]; // Nested replies
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

export default function DiscussionDetailScreen() {
    const params = useLocalSearchParams();
    const { courseId, discussionId, discussionTitle, courseName, role, isArchived } = params;
    const { isOnline, hasReconnected } = useNetworkStatus();

    // Check if course is archived
    const courseIsArchived = isArchived === 'true';

    const [discussion, setDiscussion] = useState<Discussion | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [newCommentHtml, setNewCommentHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAnonymousComment, setIsAnonymousComment] = useState(false);
    const [editingComment, setEditingComment] = useState<{ id: string, content: string } | null>(null);
    const [replyingTo, setReplyingTo] = useState<{ id: string, authorName: string } | null>(null);
    const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
    const [drafts, setDrafts] = useState<DraftPost[]>([]);
    const [syncingDrafts, setSyncingDrafts] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    // Keyboard event listeners
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setIsKeyboardVisible(true);
        });
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setIsKeyboardVisible(false);
        });

        return () => {
            keyboardDidShowListener?.remove();
            keyboardDidHideListener?.remove();
        };
    }, []);

    // Convert plain text to HTML for RichTextEditor
    const handleCommentChange = (html: string) => {
        try {
            setNewCommentHtml(html);
            // Use the HTML content directly for storage to preserve formatting
            setNewComment(html);
        } catch (error) {
            console.error('💬 DiscussionDetail: Error in handleCommentChange:', error);
        }
    };

    // Build nested comment tree from flat array
    const buildCommentTree = (allComments: Comment[]): Comment[] => {
        const commentMap = new Map<string, Comment>();
        const topLevelComments: Comment[] = [];

        // Initialize all comments with empty replies array
        allComments.forEach(comment => {
            commentMap.set(comment.id, { ...comment, replies: [] });
        });

        // Build the tree
        allComments.forEach(comment => {
            const commentWithReplies = commentMap.get(comment.id)!;

            if (comment.parentId) {
                // This is a reply - add it to parent's replies
                const parent = commentMap.get(comment.parentId);
                if (parent) {
                    parent.replies!.push(commentWithReplies);
                }
            } else {
                // This is a top-level comment
                topLevelComments.push(commentWithReplies);
            }
        });

        // Sort top-level comments by creation time (newest first)
        topLevelComments.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

        // Recursively sort replies within each comment (oldest first for replies)
        const sortReplies = (comment: Comment) => {
            if (comment.replies && comment.replies.length > 0) {
                comment.replies.sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds);
                comment.replies.forEach(sortReplies);
            }
        };

        topLevelComments.forEach(sortReplies);
        return topLevelComments;
    };

    // Initialize cache and load drafts
    useEffect(() => {
        offlineCacheService.initializeCache();
        loadDrafts();
    }, []);

    // Load cached data when offline or sync when reconnected
    useEffect(() => {
        if (!courseId || !discussionId) return;

        if (isOnline) {
            // Online: Use Firebase listeners and cache the data
            setupFirebaseListeners();
            // Sync drafts when coming back online
            if (hasReconnected) {
                syncDrafts();
            }
        } else {
            // Offline: Load cached data
            loadCachedComments();
        }

        // Sync when reconnected
        if (hasReconnected && courseId && discussionId) {
            syncCommentsAfterReconnection();
        }
    }, [courseId, discussionId, isOnline, hasReconnected]);

    // Refresh data when screen comes back into focus
    useFocusEffect(
        React.useCallback(() => {
            if (!courseId || !discussionId) return;

            // Force refresh data when screen comes into focus
            if (isOnline) {
                setupFirebaseListeners();
            } else {
                loadCachedComments();
            }

            // Refresh drafts
            loadDrafts();
        }, [courseId, discussionId, isOnline])
    );

    const loadDrafts = async () => {
        if (!discussionId) return;
        try {
            const discussionDrafts = await draftManager.getDraftsByDiscussion(discussionId as string);
            setDrafts(discussionDrafts);
        } catch (error) {
            console.error('Error loading drafts:', error);
        }
    };

    const syncDrafts = async () => {
        setSyncingDrafts(true);
        try {
            const result = await draftManager.syncAllDrafts();
            if (result.syncedCount > 0) {
                await loadDrafts(); // Refresh drafts list
            }
        } catch (error) {
            console.error('Error syncing drafts:', error);
        } finally {
            setSyncingDrafts(false);
        }
    };

    const setupFirebaseListeners = () => {
        if (!courseId || !discussionId) return;

        // Get discussion details
        const getDiscussion = async () => {
            try {
                const discussionDoc = await firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).get();
                if (discussionDoc.exists()) {
                    setDiscussion({
                        id: discussionDoc.id,
                        ...discussionDoc.data()
                    } as Discussion);
                } else {
                    console.warn(`Discussion not found: ${discussionId}`);
                    // Don't show error to user, just log it
                }
            } catch (error) {
                console.error('Error fetching discussion:', error);
                // Don't show error to user, just log it
            }
        };

        getDiscussion();

        // Listen to comments and cache them
        const commentsQuery = firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).collection('comments').orderBy('createdAt', 'desc');

        const unsubscribeComments = commentsQuery.onSnapshot(async (snapshot) => {
            const allComments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];

            // Build nested comment tree
            const commentTree = buildCommentTree(allComments);
            setComments(commentTree);

            // Cache the comments when online
            try {
                await offlineCacheService.cacheComments(
                    discussionId as string,
                    courseId as string,
                    allComments
                );
            } catch (error) {
                console.error('Error caching comments:', error);
            }
        });

        return () => {
            unsubscribeComments();
        };
    };

    const loadCachedComments = async () => {
        if (!discussionId) return;

        setIsLoadingFromCache(true);
        try {
            const cachedComments = await offlineCacheService.getCachedComments(discussionId as string);

            // Build nested comment tree from cached data
            const commentTree = buildCommentTree(cachedComments as Comment[]);
            setComments(commentTree);
        } catch (error) {
            console.error('Error loading cached comments:', error);
        } finally {
            setIsLoadingFromCache(false);
        }
    };

    const syncCommentsAfterReconnection = async () => {
        if (!courseId || !discussionId) return;

        try {
            await offlineCacheService.syncCommentsFromFirebase(
                discussionId as string,
                courseId as string
            );
            await offlineCacheService.updateLastSyncTime();
        } catch (error) {
            console.error('Error syncing comments after reconnection:', error);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        setAlertConfig({
            visible: true,
            title: 'Delete Comment',
            message: 'Are you sure you want to delete this comment?',
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
                            await firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).collection('comments').doc(commentId).delete();

                            // Update replies count
                            await firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).update({
                                replies: increment(-1)
                            });

                            // Force refresh the data to ensure deleted comment is removed
                            await refreshDiscussionData();

                            setAlertConfig({
                                visible: true,
                                title: 'Success',
                                message: 'Comment deleted successfully',
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
                            console.error('Error deleting comment:', error);
                            setAlertConfig({
                                visible: true,
                                title: 'Error',
                                message: 'Failed to delete comment. Please try again.',
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

    const handleEditComment = (comment: Comment) => {
        setEditingComment({
            id: comment.id,
            content: comment.content
        });
        setNewComment(comment.content);
        setNewCommentHtml(comment.content); // Initialize RichTextEditor with existing content
    };

    const handleUpdateComment = async () => {
        if (!editingComment || !newComment.trim()) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Please enter a comment.',
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
            await firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).collection('comments').doc(editingComment.id).update({
                content: newComment.trim(),
                updatedAt: serverTimestamp()
            });

            setNewComment('');
            setEditingComment(null);
            setIsAnonymousComment(false);

            // Force refresh the data to ensure updated comment appears
            await refreshDiscussionData();

            setAlertConfig({
                visible: true,
                title: 'Success',
                message: 'Comment updated successfully!',
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
            console.error('Error updating comment:', error);
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to update comment. Please try again.',
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

    const resetCommentForm = () => {
        setNewComment('');
        setNewCommentHtml('');
        setEditingComment(null);
        setReplyingTo(null);
        setIsAnonymousComment(false);
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Please enter a comment.',
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
        if (editingComment) {
            return handleUpdateComment();
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

            // Get user's name
            const userDoc = await firestore().collection('users').doc(user.uid).get();
            const userName = userDoc.data()?.name || 'Anonymous';

            // Add comment
            const commentData: any = {
                content: newComment.trim(),
                createdAt: serverTimestamp(),
                authorName: userName,
                authorRole: role,
                authorId: user.uid
            };

            // Add parentId if this is a reply
            if (replyingTo) {
                commentData.parentId = replyingTo.id;
            }

            // Handle anonymity for student comments
            if (role === 'student' && isAnonymousComment) {
                commentData.authorName = 'Anonymous Student';
                commentData.isAnonymous = true;
            } else {
                commentData.authorName = userName;
                commentData.isAnonymous = false;
            }

            await firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).collection('comments').add(commentData);

            // Update replies count
            await firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).update({
                replies: increment(1)
            });

            // Check for reply notification trigger (when discussion reaches 3 replies)
            try {
                await notificationHelpers.checkDiscussionReplies(courseId as string, discussionId as string, user.uid);
            } catch (notificationError) {
                console.error('Error checking reply notifications:', notificationError);
                // Don't fail the main operation if notifications fail
            }

            setNewComment('');
            setNewCommentHtml('');
            setIsAnonymousComment(false);
            setReplyingTo(null);

            // Force refresh the data to ensure new comment appears
            await refreshDiscussionData();

            setAlertConfig({
                visible: true,
                title: 'Success',
                message: replyingTo ? 'Reply added!' : 'Comment added!',
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
            console.error('Error adding comment:', error);
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to add comment. Please try again.',
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
            const draftData = {
                type: 'comment' as const,
                content: newComment.trim(),
                courseId: courseId as string,
                discussionId: discussionId as string,
                parentId: replyingTo?.id,
                isAnonymous: isAnonymousComment,
                authorRole: role as string
            };

            const draftId = await draftManager.saveDraft(draftData);

            setNewComment('');
            setNewCommentHtml('');
            setIsAnonymousComment(false);
            setReplyingTo(null);

            await loadDrafts(); // Refresh drafts list

            setAlertConfig({
                visible: true,
                title: 'Draft Saved',
                message: `Your ${replyingTo ? 'reply' : 'comment'} has been saved as a draft and will be posted when you go back online.`,
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

    const handleReplyToComment = (comment: Comment) => {
        setReplyingTo({
            id: comment.id,
            authorName: comment.authorName
        });
        setNewComment('');
    };

    const renderComment = (comment: Comment, depth: number = 0) => {
        const maxDepth = 6; // Limit nesting to prevent comments from becoming unreadable
        const isDeepNested = depth >= maxDepth;
        const actualDepth = Math.min(depth, maxDepth);

        return (
            <View key={comment.id} style={[
                styles.commentContainer,
                { marginLeft: actualDepth > 0 ? actualDepth * 8 : 0 } // Subtle indentation
            ]}>
                {/* Threading lines for replies */}
                {actualDepth > 0 && (
                    <View style={styles.threadingLinesContainer}>
                        <View style={styles.threadingLine} />
                    </View>
                )}

                <View style={[
                    styles.commentCard,
                    actualDepth > 0 && styles.replyCard,
                    isDeepNested && styles.deepNestedCard,
                    actualDepth === 1 && styles.firstLevelReply,
                    actualDepth === 2 && styles.secondLevelReply,
                    actualDepth >= 3 && styles.deepLevelReply
                ]}>
                    <View style={styles.commentHeader}>
                        <View style={styles.commentAuthorSection}>
                            <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                            <View style={[
                                styles.commentRoleTag,
                                comment.isAnonymous ? styles.anonymousTag :
                                    comment.authorRole === 'teacher' ? styles.teacherTag :
                                        comment.authorRole === 'admin' ? styles.adminTag : styles.studentTag
                            ]}>
                                <Text style={styles.commentRoleText}>
                                    {comment.authorRole}
                                </Text>
                            </View>
                            {actualDepth > 0 && (
                                <View style={styles.depthIndicator}>
                                    <Text style={styles.depthText}>L{actualDepth}</Text>
                                </View>
                            )}
                            {isDeepNested && depth > maxDepth && (
                                <View style={styles.maxDepthIndicator}>
                                    <Text style={styles.maxDepthText}>+{depth - maxDepth}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.commentActionsRow}>
                        <Text style={styles.commentDate}>{formatDate(comment.createdAt)}</Text>
                        <View style={styles.commentActions}>
                            {/* Reply button - show for all comments if not archived */}
                            {!courseIsArchived && (
                                <TouchableOpacity
                                    style={styles.replyButton}
                                    onPress={() => handleReplyToComment(comment)}
                                >
                                    <Ionicons name="chatbubble-outline" size={14} color="#4f46e5" />
                                </TouchableOpacity>
                            )}
                            {/* Show edit/delete only for comment author and if not archived */}
                            {auth().currentUser?.uid === comment.authorId && !courseIsArchived && (
                                <>
                                    <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={() => handleEditComment(comment)}
                                    >
                                        <Ionicons name="pencil" size={14} color="#666" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => handleDeleteComment(comment.id)}
                                    >
                                        <Ionicons name="trash" size={14} color="#d32f2f" />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>

                    <View style={styles.commentContent}>
                        <MarkdownRenderer content={comment.content} />
                    </View>

                    {courseIsArchived && (
                        <View style={styles.archivedNotice}>
                            <Ionicons name="archive" size={12} color="#666" />
                            <Text style={styles.archivedNoticeText}>Read only - Course archived</Text>
                        </View>
                    )}
                </View>

                {/* Recursively render nested replies */}
                {comment.replies && comment.replies.length > 0 && (
                    <View style={styles.repliesContainer}>
                        {comment.replies.map(reply => renderComment(reply, depth + 1))}
                    </View>
                )}
            </View>
        );
    };

    // Count total comments including nested replies
    const countAllComments = (comments: Comment[]): number => {
        let total = comments.length;
        comments.forEach(comment => {
            if (comment.replies && comment.replies.length > 0) {
                total += countAllComments(comment.replies);
            }
        });
        return total;
    };

    const totalComments = countAllComments(comments);

    const refreshDiscussionData = async () => {
        if (!courseId || !discussionId || !isOnline) return;

        try {
            // Fetch fresh discussion and comments data directly
            const [discussionDoc, commentsSnapshot] = await Promise.all([
                firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).get(),
                firestore().collection('courses').doc(courseId as string).collection('discussions').doc(discussionId as string).collection('comments').orderBy('createdAt', 'desc').get()
            ]);

            if (discussionDoc.exists()) {
                setDiscussion({
                    id: discussionDoc.id,
                    ...discussionDoc.data()
                } as Discussion);
            }

            const allComments = commentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];

            // Build nested comment tree
            const commentTree = buildCommentTree(allComments);
            setComments(commentTree);

            // Cache the comments
            try {
                await offlineCacheService.cacheComments(
                    discussionId as string,
                    courseId as string,
                    allComments
                );
            } catch (error) {
                console.error('Error caching refreshed comments:', error);
            }
        } catch (error) {
            console.error('Error refreshing discussion data:', error);
        }
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
                    <Text style={styles.headerTitle}>{discussionTitle}</Text>
                    <Text style={styles.headerSubtitle}>{courseName}</Text>
                </View>
                <ConnectivityIndicator size="small" style={styles.connectivityIndicator} />
            </LinearGradient>

            <View style={styles.mainContainer}>
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.contentContainer}
                    keyboardDismissMode="interactive"
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                >
                    {discussion && (
                        <View style={styles.discussionCard}>
                            <View style={styles.postHeader}>
                                <Text style={styles.discussionTitle}>{discussion.title}</Text>
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
                            <View style={styles.discussionContentContainer}>
                                <MarkdownRenderer content={discussion.content} />
                            </View>
                            <View style={styles.postMeta}>
                                <Text style={styles.postAuthor}>By {discussion.authorName}</Text>
                                <Text style={styles.postDate}>{formatDate(discussion.createdAt)}</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.commentsSection}>
                        {/* Offline/Cache Status Indicator */}
                        {(!isOnline || isLoadingFromCache) && (
                            <View style={styles.offlineIndicator}>
                                <Ionicons
                                    name={!isOnline ? "cloud-offline" : "refresh"}
                                    size={16}
                                    color={!isOnline ? "#f59e0b" : "#4f46e5"}
                                />
                                <Text style={styles.offlineText}>
                                    {!isOnline ? "Offline - Showing cached comments" : "Loading cached comments..."}
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
                        {isOnline && drafts.filter(d => d.type === 'comment' && (d.status === 'draft' || d.status === 'failed')).length > 0 && (
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

                        <View style={styles.commentsSeparator}>
                            <View style={styles.separatorLine} />
                            <Text style={styles.commentsTitle}>
                                Comments ({totalComments + drafts.filter(d => d.type === 'comment').length})
                            </Text>
                            <View style={styles.separatorLine} />
                        </View>

                        {/* Draft Comments */}
                        {drafts.filter(draft => draft.type === 'comment' && (draft.status === 'draft' || draft.status === 'failed' || draft.status === 'pending')).map((draft) => (
                            <View key={draft.id} style={[styles.commentCard, styles.draftCommentCard]}>
                                <View style={styles.commentHeader}>
                                    <View style={styles.commentAuthorSection}>
                                        <Text style={styles.commentAuthor}>
                                            {draft.isAnonymous ? 'Anonymous Student' : `${draft.authorRole}`}
                                        </Text>
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
                                <View style={styles.commentContent}>
                                    <Text style={styles.commentText}>{draft.content}</Text>
                                </View>
                                <View style={styles.commentActionsRow}>
                                    <Text style={styles.commentDate}>
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

                        {comments.length === 0 && drafts.filter(d => d.type === 'comment').length === 0 ? (
                            <View style={styles.emptyComments}>
                                <Text style={styles.emptyText}>
                                    {!isOnline ? "No cached comments available" : "No comments yet. Be the first to comment!"}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.commentsContainer}>
                                {comments.map((comment) => (
                                    <View key={comment.id}>
                                        {renderComment(comment)}
                                        {!isOnline && (
                                            <View style={styles.cachedIndicator}>
                                                <Ionicons name="download" size={12} color="#4f46e5" />
                                                <Text style={styles.cachedText}>Cached content</Text>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </ScrollView>

                {!courseIsArchived && (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.commentInputContainer}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    >
                        {/* Reply context banner */}
                        {replyingTo && (
                            <View style={styles.replyContext}>
                                <Ionicons name="chatbubble-outline" size={16} color="#4f46e5" />
                                <Text style={styles.replyContextText}>
                                    Replying to {replyingTo.authorName}
                                </Text>
                                <TouchableOpacity
                                    style={styles.cancelReplyButton}
                                    onPress={() => setReplyingTo(null)}
                                >
                                    <Ionicons name="close" size={16} color="#666" />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.commentInputContent}>
                            {/* Anonymity option for students */}
                            {role === 'student' && (
                                <View style={styles.anonymityOption}>
                                    <Text style={styles.anonymityLabel}>Comment anonymously</Text>
                                    <Switch
                                        value={isAnonymousComment}
                                        onValueChange={setIsAnonymousComment}
                                        trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
                                        thumbColor={isAnonymousComment ? '#fff' : '#f4f3f4'}
                                    />
                                </View>
                            )}

                            <View style={styles.commentInputRow}>
                                <RichTextEditor
                                    value={newCommentHtml}
                                    onChange={handleCommentChange}
                                    placeholder={
                                        editingComment ? "Edit your comment..." :
                                            replyingTo ? `Reply to ${replyingTo.authorName}...` :
                                                "Add a comment..."
                                    }
                                    style={styles.commentInput}
                                />
                                {(editingComment || replyingTo) && (
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={resetCommentForm}
                                    >
                                        <Ionicons name="close" size={20} color="#666" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[styles.sendButton, loading && styles.buttonDisabled]}
                                    onPress={handleAddComment}
                                    disabled={loading || !newComment.trim()}
                                >
                                    {editingComment ? (
                                        <Ionicons name="checkmark" size={20} color="#fff" />
                                    ) : (
                                        <Ionicons name="send" size={20} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                )}

                {courseIsArchived && (
                    <View style={styles.archivedBanner}>
                        <Ionicons name="archive" size={20} color="#666" />
                        <Text style={styles.archivedBannerText}>This course is archived - Comments are disabled</Text>
                    </View>
                )}
            </View>

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
    mainContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    contentContainer: {
        paddingBottom: 100, // Back to reasonable padding
    },
    discussionCard: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    discussionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        letterSpacing: -0.3,
        lineHeight: 26,
    },
    roleTag: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        marginLeft: 12,
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
    discussionContent: {
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
    commentsSection: {
        flex: 1,
    },
    commentsSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    commentsTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginHorizontal: 12,
        letterSpacing: -0.3,
    },
    emptyComments: {
        padding: 32,
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    emptyText: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 24,
    },
    commentsContainer: {
        flex: 1,
    },
    commentContainer: {
        marginBottom: 16,
        position: 'relative',
    },
    commentCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 12,
    },
    replyCard: {
        backgroundColor: '#f8fafc',
        borderLeftWidth: 3,
        borderLeftColor: '#4f46e5',
        marginLeft: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    deepNestedCard: {
        backgroundColor: 'transparent',
        borderLeftWidth: 0,
    },
    firstLevelReply: {
        backgroundColor: 'transparent',
        borderLeftWidth: 0,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    secondLevelReply: {
        backgroundColor: 'transparent',
        borderLeftWidth: 0,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    deepLevelReply: {
        backgroundColor: 'transparent',
        borderLeftWidth: 0,
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    commentAuthorSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    commentAuthor: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginRight: 12,
    },
    commentRoleTag: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
    },
    commentRoleText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    depthIndicator: {
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    depthText: {
        fontSize: 10,
        color: '#4f46e5',
        fontWeight: '600',
    },
    commentActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    commentContent: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
        marginBottom: 0,
        paddingVertical: 4,
    },
    commentDate: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
    },
    commentInputContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#fff',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    commentInputContent: {
        paddingHorizontal: 0,
    },
    commentInputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
        marginTop: 12,
    },
    commentInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 100,
        maxHeight: 200, // Increased to allow more content and proper scrolling
        fontSize: 15,
        color: '#1e293b',
        backgroundColor: '#fff',
        lineHeight: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    sendButton: {
        backgroundColor: '#4f46e5',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonDisabled: {
        opacity: 0.5,
        shadowOpacity: 0.1,
    },
    anonymityOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 8,
    },
    anonymityLabel: {
        fontSize: 13,
        color: '#1e293b',
        fontWeight: '500',
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
    cancelButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    replyButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    archivedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 10,
        backgroundColor: '#fafbfc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    archivedNoticeText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 6,
        fontWeight: '500',
    },
    archivedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    archivedBannerText: {
        fontSize: 15,
        color: '#64748b',
        marginLeft: 12,
        fontWeight: '500',
    },
    repliesContainer: {
        marginTop: 8,
        position: 'relative',
    },
    replyContext: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    replyContextText: {
        fontSize: 14,
        color: '#1e293b',
        marginLeft: 12,
        fontWeight: '500',
        flex: 1,
    },
    cancelReplyButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    offlineText: {
        fontSize: 14,
        color: '#1e293b',
        marginLeft: 12,
        fontWeight: '500',
        flex: 1,
    },
    syncIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    syncText: {
        fontSize: 14,
        color: '#1e293b',
        marginLeft: 12,
        fontWeight: '500',
        flex: 1,
    },
    draftCommentCard: {
        backgroundColor: '#f8fafc',
        borderLeftWidth: 3,
        borderLeftColor: '#4f46e5',
        marginLeft: 10,
    },
    statusBadge: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
    },
    statusBadgeText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '700',
        letterSpacing: 0.3,
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
        marginTop: 8,
        padding: 10,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    errorNoticeText: {
        fontSize: 12,
        color: '#ef4444',
        marginLeft: 6,
        fontWeight: '500',
    },
    cachedIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cachedText: {
        fontSize: 14,
        color: '#1e293b',
        marginLeft: 12,
        fontWeight: '500',
        flex: 1,
    },
    connectivityIndicator: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
        marginLeft: 8,
    },
    commentText: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
        marginBottom: 0,
    },
    maxDepthIndicator: {
        backgroundColor: 'rgba(229, 231, 235, 0.5)', // Light gray background
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        marginLeft: 8,
    },
    maxDepthText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    threadingLinesContainer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 1, // Single vertical line
        backgroundColor: '#cbd5e1', // Default color for non-last lines
    },
    threadingLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: '#cbd5e1', // Default color for non-last lines
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
    discussionContentContainer: {
        marginBottom: 20,
    },
    commentContentContainer: {
        marginBottom: 12,
    },
}); 