import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from './firebase/config';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, updateDoc, increment, deleteDoc } from 'firebase/firestore';

interface Comment {
    id: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
    authorId: string;
    isAnonymous?: boolean;
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
            const commentsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Comment[];
            setComments(commentsList);
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

            setNewComment('');
            setIsAnonymousComment(false);
            Alert.alert('Success', 'Comment added!');
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
                    <Text style={styles.commentsTitle}>
                        Comments ({comments.length})
                    </Text>

                    {comments.length === 0 ? (
                        <View style={styles.emptyComments}>
                            <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
                        </View>
                    ) : (
                        comments.map((comment) => (
                            <View key={comment.id} style={styles.commentCard}>
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
                                    </View>
                                    {/* Show edit/delete only for comment author and if not archived */}
                                    {auth.currentUser?.uid === comment.authorId && !courseIsArchived && (
                                        <View style={styles.commentActions}>
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
                                        </View>
                                    )}
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
                        ))
                    )}
                </View>
            </ScrollView>

            {!courseIsArchived && (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.commentInputContainer}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
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
                            placeholder={editingComment ? "Edit your comment..." : "Add a comment..."}
                            value={newComment}
                            onChangeText={setNewComment}
                            multiline
                            placeholderTextColor="#666"
                        />
                        {editingComment && (
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
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    content: {
        flex: 1,
        padding: 15,
    },
    discussionCard: {
        backgroundColor: '#f8f8f8',
        padding: 20,
        borderRadius: 10,
        marginBottom: 20,
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    discussionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    roleTag: {
        backgroundColor: '#81171b',
        padding: 6,
        borderRadius: 6,
        marginLeft: 10,
    },
    teacherTag: {
        backgroundColor: '#81171b',
    },
    studentTag: {
        backgroundColor: '#D65108',
    },
    roleTagText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
    },
    discussionContent: {
        fontSize: 16,
        color: '#555',
        lineHeight: 22,
        marginBottom: 15,
    },
    postMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    postAuthor: {
        fontSize: 14,
        color: '#81171b',
        fontWeight: '500',
    },
    postDate: {
        fontSize: 12,
        color: '#666',
    },
    commentsSection: {
        flex: 1,
    },
    commentsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    emptyComments: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    commentCard: {
        backgroundColor: '#f0f0f0',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
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
    },
    commentAuthor: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginRight: 10,
    },
    commentRoleTag: {
        backgroundColor: '#81171b',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    commentRoleText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '500',
    },
    commentContent: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
        marginBottom: 8,
    },
    commentDate: {
        fontSize: 12,
        color: '#666',
    },
    commentInputContainer: {
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        backgroundColor: '#fff',
        padding: 15,
    },
    commentInputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    commentInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginRight: 10,
        maxHeight: 100,
        fontSize: 16,
    },
    sendButton: {
        backgroundColor: '#81171b',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    anonymityOption: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    anonymityLabel: {
        fontSize: 14,
        color: '#333',
        marginRight: 10,
    },
    anonymousTag: {
        backgroundColor: '#666',
    },
    commentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
    },
    editButton: {
        padding: 5,
    },
    deleteButton: {
        padding: 5,
    },
    cancelButton: {
        padding: 5,
    },
    archivedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    archivedNoticeText: {
        fontSize: 12,
        color: '#666',
        marginLeft: 5,
    },
    archivedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    archivedBannerText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 10,
    },
}); 