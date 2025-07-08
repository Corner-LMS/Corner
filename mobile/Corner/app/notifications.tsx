import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, PanResponder, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

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
        const user = auth().currentUser;
        if (!user) {
            router.replace('/(auth)/login');
            return;
        }

        // Listen to user's notifications
        const notificationsQuery = firestore().collection('notifications').where('userId', '==', user.uid).orderBy('timestamp', 'desc');

        const unsubscribe = notificationsQuery.onSnapshot(
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
            await firestore().collection('notifications').doc(notificationId).update({
                read: true
            });

            // Also decrease the user's badge count
            const user = auth().currentUser;
            if (user) {
                const userRef = firestore().collection('users').doc(user.uid);
                const userDoc = await userRef.get();
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const currentCount = userData?.notificationData?.unreadCount || 0;
                    if (currentCount > 0) {
                        await userRef.update({
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
            await firestore().collection('notifications').doc(notificationId).delete();
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
                const courseDoc = await firestore().collection('courses').doc(notification.courseId).get();
                if (courseDoc.exists()) {
                    const courseData = courseDoc.data();

                    // Get user role for navigation
                    const user = auth().currentUser;
                    if (user) {
                        const userDoc = await firestore().collection('users').doc(user.uid).get();
                        const userData = userDoc.data();
                        const userRole = userData?.role || 'student';

                        router.push({
                            pathname: '/course-detail',
                            params: {
                                courseId: notification.courseId,
                                courseName: notification.courseName,
                                courseCode: courseData?.code || 'Unknown',
                                instructorName: courseData?.instructorName || 'Unknown',
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
                const courseDoc = await firestore().collection('courses').doc(notification.courseId).get();
                if (courseDoc.exists()) {
                    const courseData = courseDoc.data();

                    // Get user role
                    const user = auth().currentUser;
                    if (user) {
                        const userDoc = await firestore().collection('users').doc(user.uid).get();
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
                                firestore().collection('notifications').doc(notif.id).delete()
                            );
                            await Promise.all(deletePromises);

                            // Also reset the user's badge count
                            const user = auth().currentUser;
                            if (user) {
                                await firestore().collection('users').doc(user.uid).update({
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
            case 'teacher_online':
                return 'person';
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
                    const user = auth().currentUser;
                    if (user) {
                        const userRef = firestore().collection('users').doc(user.uid);
                        const userDoc = await userRef.get();
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            const currentCount = userData?.notificationData?.unreadCount || 0;
                            if (currentCount > 0) {
                                await userRef.update({
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
                <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.header}
                >
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Notifications</Text>
                    <View style={{ width: 24 }} />
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <Text>Loading notifications...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
                {notifications.length > 0 && (
                    <TouchableOpacity onPress={clearAllNotifications}>
                        <Ionicons name="trash-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                )}
            </LinearGradient>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {notifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-outline" size={64} color="#cbd5e1" />
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
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingTop: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f8fafc',
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
        borderRadius: 16,
        padding: 20,
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#4f46e5',
        backgroundColor: '#fefefe',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    notificationContent: {
        flex: 1,
        gap: 6,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a202c',
        lineHeight: 22,
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    notificationBody: {
        fontSize: 14,
        color: '#4a5568',
        lineHeight: 20,
        marginBottom: 8,
        fontWeight: '500',
    },
    notificationTime: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600',
    },
    unreadDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4f46e5',
        marginTop: 6,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    swipeContainer: {
        marginHorizontal: 20,
        marginVertical: 8,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
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
        paddingRight: 24,
        flexDirection: 'row',
        gap: 8,
    },
    deleteText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    notificationWrapper: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
    },
    swipeHint: {
        color: '#64748b',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 12,
        marginHorizontal: 20,
        fontWeight: '600',
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
}); 