import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/ firebase-config';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

interface Notification {
    id: string;
    type: 'announcement' | 'discussion_milestone' | 'discussion_replies' | 'teacher_discussion_milestone';
    title: string;
    body: string;
    courseId: string;
    courseName: string;
    timestamp: any;
    read: boolean;
    data?: any;
}

export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            router.replace('/(auth)/login');
            return;
        }

        // Listen to user's notifications
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(
            notificationsQuery,
            (snapshot) => {
                const notifs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Notification));
                setNotifications(notifs);
                setLoading(false);
            },
            (error) => {
                console.error('Error loading notifications:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const markAsRead = async (notificationId: string) => {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true
            });

            // Also decrease the user's badge count
            const user = auth.currentUser;
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const currentCount = userData.notificationData?.unreadCount || 0;
                    if (currentCount > 0) {
                        await updateDoc(userRef, {
                            'notificationData.unreadCount': currentCount - 1
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const deleteNotification = async (notificationId: string) => {
        try {
            await deleteDoc(doc(db, 'notifications', notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const handleNotificationPress = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            await markAsRead(notification.id);
        }

        // Navigate based on notification type with proper parameters
        if (notification.type === 'announcement' || notification.type === 'discussion_milestone' || notification.type === 'teacher_discussion_milestone') {
            // Get course details for proper navigation
            try {
                const courseDoc = await getDoc(doc(db, 'courses', notification.courseId));
                if (courseDoc.exists()) {
                    const courseData = courseDoc.data();

                    // Get user role for navigation
                    const user = auth.currentUser;
                    if (user) {
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        const userData = userDoc.data();
                        const userRole = userData?.role || 'student';

                        router.push({
                            pathname: '/course-detail',
                            params: {
                                courseId: notification.courseId,
                                courseName: notification.courseName,
                                courseCode: courseData.code || 'Unknown',
                                instructorName: courseData.instructorName || 'Unknown',
                                role: userRole
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error getting course details:', error);
                // Fallback navigation
                router.push(`/course-detail?courseId=${notification.courseId}`);
            }
        } else if (notification.type === 'discussion_replies') {
            // Get course details for discussion navigation
            try {
                const courseDoc = await getDoc(doc(db, 'courses', notification.courseId));
                if (courseDoc.exists()) {
                    const courseData = courseDoc.data();

                    // Get user role
                    const user = auth.currentUser;
                    if (user) {
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        const userData = userDoc.data();
                        const userRole = userData?.role || 'student';

                        router.push({
                            pathname: '/discussion-detail',
                            params: {
                                courseId: notification.courseId,
                                discussionId: notification.data?.discussionId,
                                discussionTitle: notification.data?.discussionTitle || 'Discussion',
                                courseName: notification.courseName,
                                role: userRole
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error getting course details for discussion:', error);
                // Fallback navigation
                router.push(`/discussion-detail?courseId=${notification.courseId}&discussionId=${notification.data?.discussionId}`);
            }
        }
    };

    const clearAllNotifications = () => {
        Alert.alert(
            'Clear All Notifications',
            'Are you sure you want to delete all notifications?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const deletePromises = notifications.map(notif =>
                                deleteDoc(doc(db, 'notifications', notif.id))
                            );
                            await Promise.all(deletePromises);

                            // Also reset the user's badge count
                            const user = auth.currentUser;
                            if (user) {
                                await updateDoc(doc(db, 'users', user.uid), {
                                    'notificationData.unreadCount': 0
                                });
                            }
                        } catch (error) {
                            console.error('Error clearing notifications:', error);
                        }
                    }
                }
            ]
        );
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'announcement':
                return 'megaphone';
            case 'discussion_milestone':
                return 'chatbubbles';
            case 'discussion_replies':
                return 'chatbubble-ellipses';
            default:
                return 'notifications';
        }
    };

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const SwipeableNotificationCard = ({ notification }: { notification: Notification }) => {
        const translateX = useRef(new Animated.Value(0)).current;
        const rowHeight = useRef(new Animated.Value(1)).current;
        const rowOpacity = useRef(new Animated.Value(1)).current;

        const panResponder = useRef(
            PanResponder.create({
                onMoveShouldSetPanResponder: (evt, gestureState) => {
                    return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
                },
                onPanResponderMove: (evt, gestureState) => {
                    // Only allow left swipe (negative dx)
                    if (gestureState.dx < 0) {
                        translateX.setValue(gestureState.dx);
                    }
                },
                onPanResponderRelease: (evt, gestureState) => {
                    if (gestureState.dx < -100) {
                        // Swipe far enough to delete
                        handleSwipeDelete(notification.id);
                    } else {
                        // Snap back
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                        }).start();
                    }
                },
            })
        ).current;

        const handleSwipeDelete = async (notificationId: string) => {
            // Animate out
            Animated.parallel([
                Animated.timing(translateX, {
                    toValue: -400,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(rowOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(rowHeight, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start(async () => {
                // Delete from Firestore
                await deleteNotification(notificationId);

                // Also decrease badge count if notification was unread
                if (!notification.read) {
                    const user = auth.currentUser;
                    if (user) {
                        const userRef = doc(db, 'users', user.uid);
                        const userDoc = await getDoc(userRef);
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            const currentCount = userData.notificationData?.unreadCount || 0;
                            if (currentCount > 0) {
                                await updateDoc(userRef, {
                                    'notificationData.unreadCount': currentCount - 1
                                });
                            }
                        }
                    }
                }
            });
        };

        const deleteIndicatorOpacity = translateX.interpolate({
            inputRange: [-100, -50, 0],
            outputRange: [1, 0.5, 0],
            extrapolate: 'clamp',
        });

        return (
            <Animated.View
                style={[
                    styles.swipeContainer,
                    {
                        opacity: rowOpacity,
                        transform: [{ scaleY: rowHeight }]
                    }
                ]}
            >
                {/* Delete indicator background */}
                <Animated.View
                    style={[
                        styles.deleteBackground,
                        { opacity: deleteIndicatorOpacity }
                    ]}
                >
                    <Ionicons name="trash" size={24} color="#fff" />
                    <Text style={styles.deleteText}>Delete</Text>
                </Animated.View>

                {/* Notification card */}
                <Animated.View
                    style={[
                        styles.notificationWrapper,
                        { transform: [{ translateX }] }
                    ]}
                    {...panResponder.panHandlers}
                >
                    <TouchableOpacity
                        style={[
                            styles.notificationCard,
                            !notification.read && styles.unreadCard
                        ]}
                        onPress={() => handleNotificationPress(notification)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.notificationHeader}>
                            <View style={styles.iconContainer}>
                                <Ionicons
                                    name={getNotificationIcon(notification.type)}
                                    size={24}
                                    color="#4f46e5"
                                />
                            </View>
                            <View style={styles.notificationContent}>
                                <Text style={styles.notificationTitle}>
                                    {notification.title}
                                </Text>
                                <Text style={styles.notificationBody}>
                                    {notification.body}
                                </Text>
                                <Text style={styles.notificationTime}>
                                    {formatTimestamp(notification.timestamp)}
                                </Text>
                            </View>
                            {!notification.read && (
                                <View style={styles.unreadDot} />
                            )}
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Notifications</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <Text>Loading notifications...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
                {notifications.length > 0 && (
                    <TouchableOpacity onPress={clearAllNotifications}>
                        <Ionicons name="trash-outline" size={20} color="#4f46e5" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {notifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No notifications yet</Text>
                        <Text style={styles.emptySubtext}>
                            You'll receive notifications for announcements, discussion milestones, and replies to your posts.
                        </Text>
                        <Text style={styles.swipeHint}>
                            💡 Tip: Swipe left on any notification to delete it
                        </Text>
                    </View>
                ) : (
                    <View>
                        <Text style={styles.swipeHint}>
                            💡 Swipe left on any notification to delete it
                        </Text>
                        {notifications.map((notification) => (
                            <SwipeableNotificationCard
                                key={notification.id}
                                notification={notification}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(241, 245, 249, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        letterSpacing: -0.3,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingTop: 120,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#475569',
        marginTop: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 16,
        fontWeight: '500',
    },
    notificationCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
    },
    unreadCard: {
        borderLeftWidth: 6,
        borderLeftColor: '#4f46e5',
        backgroundColor: '#fefefe',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 20,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    notificationContent: {
        flex: 1,
        gap: 8,
    },
    notificationTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: 24,
        marginBottom: 6,
        letterSpacing: -0.2,
    },
    notificationBody: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 22,
        marginBottom: 12,
        fontWeight: '500',
    },
    notificationTime: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '600',
    },
    unreadDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4f46e5',
        marginTop: 8,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
    },
    swipeContainer: {
        marginHorizontal: 20,
        marginVertical: 8,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    deleteBackground: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'flex-end',
        backgroundColor: '#ef4444',
        paddingRight: 32,
        flexDirection: 'row',
        gap: 12,
    },
    deleteText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    notificationWrapper: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 20,
    },
    swipeHint: {
        color: '#64748b',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 16,
        marginHorizontal: 20,
        fontWeight: '600',
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
}); 