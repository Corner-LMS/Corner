import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../config/ firebase-config';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { notificationHelpers } from '../services/notificationHelpers';

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

    // Check if course is archived
    const courseIsArchived = isArchived === 'true';

    const [discussion, setDiscussion] = useState<Discussion | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAnonymousComment, setIsAnonymousComment] = useState(false);
    const [editingComment, setEditingComment] = useState<{ id: string, content: string } | null>(null);
    const [replyingTo, setReplyingTo] = useState<{ id: string, authorName: string } | null>(null);

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

    useEffect(() => {
        if (!courseId || !discussionId) return;

        // Get discussion details
        const getDiscussion = async () => {
            const discussionDoc = await getDoc(doc(db, 'courses', courseId as string, 'discussions', discussionId as string));
            if (discussionDoc.exists()) {
                setDiscussion({
                    id: discussionDoc.id,
                    ...discussionDoc.data()
                } as Discussion);
            }
        };

        getDiscussion();

        // Listen to comments
        const commentsQuery = query(
            collection(db, 'courses', courseId as string, 'discussions', discussionId as string, 'comments'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
            const allComments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];

            // Build nested comment tree
            const commentTree = buildCommentTree(allComments);
            setComments(commentTree);
        });

        return () => {
            unsubscribeComments();
        };
    }, [courseId, discussionId]);

    const handleDeleteComment = async (commentId: string) => {
        Alert.alert(
            'Delete Comment',
            'Are you sure you want to delete this comment?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'courses', courseId as string, 'discussions', discussionId as string, 'comments', commentId));

                            // Update replies count
                            await updateDoc(doc(db, 'courses', courseId as string, 'discussions', discussionId as string), {
                                replies: increment(-1)
                            });

                            Alert.alert('Success', 'Comment deleted successfully');
                        } catch (error) {
                            console.error('Error deleting comment:', error);
                            Alert.alert('Error', 'Failed to delete comment. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    const handleEditComment = (comment: Comment) => {
        setEditingComment({
            id: comment.id,
            content: comment.content
        });
        setNewComment(comment.content);
    };

    const handleUpdateComment = async () => {
        if (!editingComment || !newComment.trim()) {
            Alert.alert('Error', 'Please enter a comment.');
            return;
        }

        setLoading(true);
        try {
            await updateDoc(doc(db, 'courses', courseId as string, 'discussions', discussionId as string, 'comments', editingComment.id), {
                content: newComment.trim(),
                updatedAt: serverTimestamp()
            });

            setNewComment('');
            setEditingComment(null);
            setIsAnonymousComment(false);
            Alert.alert('Success', 'Comment updated successfully!');
        } catch (error) {
            console.error('Error updating comment:', error);
            Alert.alert('Error', 'Failed to update comment. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const resetCommentForm = () => {
        setNewComment('');
        setEditingComment(null);
        setReplyingTo(null);
        setIsAnonymousComment(false);
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) {
            Alert.alert('Error', 'Please enter a comment.');
            return;
        }

        // If editing, use update function instead
        if (editingComment) {
            return handleUpdateComment();
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'You must be logged in.');
                return;
            }

            // Get user's name
            const userDoc = await getDoc(doc(db, 'users', user.uid));
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

            await addDoc(collection(db, 'courses', courseId as string, 'discussions', discussionId as string, 'comments'), commentData);

            // Update replies count
            await updateDoc(doc(db, 'courses', courseId as string, 'discussions', discussionId as string), {
                replies: increment(1)
            });

            // Check for reply notification trigger (when discussion reaches 3 replies)
            try {
                await notificationHelpers.checkDiscussionReplies(courseId as string, discussionId as string, user.uid);
                console.log('Reply notification check triggered');
            } catch (notificationError) {
                console.error('Error checking reply notifications:', notificationError);
                // Don't fail the main operation if notifications fail
            }

            setNewComment('');
            setIsAnonymousComment(false);
            setReplyingTo(null);
            Alert.alert('Success', replyingTo ? 'Reply added!' : 'Comment added!');
        } catch (error) {
            console.error('Error adding comment:', error);
            Alert.alert('Error', 'Failed to add comment. Please try again.');
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

    const handleReplyToComment = (comment: Comment) => {
        setReplyingTo({
            id: comment.id,
            authorName: comment.authorName
        });
        setNewComment('');
    };

    const renderComment = (comment: Comment, depth: number = 0) => {
        const maxDepth = 8; // Prevent excessive nesting for UI readability
        const isDeepNested = depth >= maxDepth;

        return (
            <View key={comment.id}>
                <View style={[
                    styles.commentWrapper,
                    { marginLeft: Math.min(depth * 20, maxDepth * 20) }
                ]}>
                    {depth > 0 && <View style={[styles.threadLine, { left: -10 }]} />}

                    <View style={[
                        styles.commentCard,
                        depth > 0 && styles.replyCard,
                        isDeepNested && styles.deepNestedCard
                    ]}>
                        <View style={styles.commentHeader}>
                            <View style={styles.commentAuthorSection}>
                                <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                                <View style={[
                                    styles.commentRoleTag,
                                    comment.isAnonymous ? styles.studentTag :
                                        comment.authorRole === 'teacher' ? styles.teacherTag : styles.studentTag
                                ]}>
                                    <Text style={styles.commentRoleText}>
                                        {comment.authorRole}
                                    </Text>
                                </View>
                                {depth > 0 && (
                                    <View style={styles.depthIndicator}>
                                        <Text style={styles.depthText}>L{depth}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.commentActions}>
                                {/* Reply button - show for all comments if not archived */}
                                {!courseIsArchived && (
                                    <TouchableOpacity
                                        style={styles.replyButton}
                                        onPress={() => handleReplyToComment(comment)}
                                    >
                                        <Ionicons name="chatbubble-outline" size={14} color="#81171b" />
                                    </TouchableOpacity>
                                )}
                                {/* Show edit/delete only for comment author and if not archived */}
                                {auth.currentUser?.uid === comment.authorId && !courseIsArchived && (
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
                        <Text style={styles.commentContent}>{comment.content}</Text>
                        <Text style={styles.commentDate}>{formatDate(comment.createdAt)}</Text>
                        {courseIsArchived && (
                            <View style={styles.archivedNotice}>
                                <Ionicons name="archive" size={12} color="#666" />
                                <Text style={styles.archivedNoticeText}>Read only - Course archived</Text>
                            </View>
                        )}
                    </View>
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

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#81171b" />
                </Pressable>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{discussionTitle}</Text>
                    <Text style={styles.headerSubtitle}>{courseName}</Text>
                </View>
            </View>

            <ScrollView style={styles.content}>
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
                        <Text style={styles.discussionContent}>{discussion.content}</Text>
                        <View style={styles.postMeta}>
                            <Text style={styles.postAuthor}>By {discussion.authorName}</Text>
                            <Text style={styles.postDate}>{formatDate(discussion.createdAt)}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.commentsSection}>
                    <View style={styles.commentsSeparator}>
                        <View style={styles.separatorLine} />
                        <Text style={styles.commentsTitle}>
                            Comments ({totalComments})
                        </Text>
                        <View style={styles.separatorLine} />
                    </View>

                    {comments.length === 0 ? (
                        <View style={styles.emptyComments}>
                            <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
                        </View>
                    ) : (
                        <View style={styles.commentsContainer}>
                            {comments.map((comment) => renderComment(comment))}
                        </View>
                    )}
                </View>
            </ScrollView>

            {!courseIsArchived && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.commentInputContainer}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    {/* Reply context banner */}
                    {replyingTo && (
                        <View style={styles.replyContext}>
                            <Ionicons name="chatbubble-outline" size={16} color="#81171b" />
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

                    {/* Anonymity option for students */}
                    {role === 'student' && (
                        <View style={styles.anonymityOption}>
                            <Text style={styles.anonymityLabel}>Comment anonymously</Text>
                            <Switch
                                value={isAnonymousComment}
                                onValueChange={setIsAnonymousComment}
                                trackColor={{ false: '#e0e0e0', true: '#81171b' }}
                                thumbColor={isAnonymousComment ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    )}

                    <View style={styles.commentInputRow}>
                        <TextInput
                            style={styles.commentInput}
                            placeholder={
                                editingComment ? "Edit your comment..." :
                                    replyingTo ? `Reply to ${replyingTo.authorName}...` :
                                        "Add a comment..."
                            }
                            value={newComment}
                            onChangeText={setNewComment}
                            multiline
                            placeholderTextColor="#666"
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
                </KeyboardAvoidingView>
            )}

            {courseIsArchived && (
                <View style={styles.archivedBanner}>
                    <Ionicons name="archive" size={20} color="#666" />
                    <Text style={styles.archivedBannerText}>This course is archived - Comments are disabled</Text>
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
        marginTop: 4,
        fontWeight: '500',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    discussionCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    discussionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        letterSpacing: -0.5,
    },
    roleTag: {
        backgroundColor: '#81171b',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        marginLeft: 12,
        shadowColor: '#81171b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    teacherTag: {
        backgroundColor: '#81171b',
    },
    studentTag: {
        backgroundColor: '#d97706',
    },
    roleTagText: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    discussionContent: {
        fontSize: 17,
        color: '#475569',
        lineHeight: 26,
        marginBottom: 20,
    },
    postMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    postAuthor: {
        fontSize: 15,
        color: '#81171b',
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
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyText: {
        fontSize: 17,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 24,
    },
    commentsContainer: {
        flex: 1,
    },
    commentWrapper: {
        marginBottom: 16,
        position: 'relative',
    },
    threadLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: 'rgba(129, 23, 27, 0.2)',
        borderRadius: 1,
    },
    commentCard: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderLeftWidth: 3,
        borderLeftColor: '#f1f5f9',
    },
    replyCard: {
        backgroundColor: '#f8fafc',
        borderLeftWidth: 3,
        borderLeftColor: '#81171b',
        marginLeft: 10,
    },
    deepNestedCard: {
        backgroundColor: '#f1f5f9',
        borderLeftColor: '#64748b',
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    commentAuthorSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    commentAuthor: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginRight: 12,
    },
    commentRoleTag: {
        backgroundColor: '#81171b',
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
        backgroundColor: 'rgba(129, 23, 27, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    depthText: {
        fontSize: 10,
        color: '#81171b',
        fontWeight: '600',
    },
    commentContent: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
        marginBottom: 12,
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
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    commentInputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
    },
    commentInput: {
        flex: 1,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 14,
        maxHeight: 120,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        lineHeight: 22,
    },
    sendButton: {
        backgroundColor: '#81171b',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#81171b',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.5,
        shadowOpacity: 0.1,
    },
    anonymityOption: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    anonymityLabel: {
        fontSize: 15,
        color: '#1e293b',
        marginRight: 12,
        fontWeight: '500',
    },
    anonymousTag: {
        backgroundColor: '#64748b',
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    editButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    deleteButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
    },
    cancelButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    replyButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    archivedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
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
    },
    replyContext: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginBottom: 16,
    },
    replyContextText: {
        fontSize: 15,
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
}); 