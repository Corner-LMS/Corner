import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from './firebase/config';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

interface Notification {
    id: string;
    type: 'announcement' | 'discussion_milestone' | 'discussion_replies';
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
        if (notification.type === 'announcement' || notification.type === 'discussion_milestone') {
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

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#81171b" />
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
                    <Ionicons name="arrow-back" size={24} color="#81171b" />
                </TouchableOpacity>
                <Text style={styles.title}>Notifications</Text>
                <TouchableOpacity onPress={clearAllNotifications}>
                    <Ionicons name="trash-outline" size={24} color="#81171b" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView}>
                {notifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No notifications yet</Text>
                        <Text style={styles.emptySubtext}>
                            You'll receive notifications for announcements, discussion milestones, and replies to your posts.
                        </Text>
                    </View>
                ) : (
                    notifications.map((notification) => (
                        <TouchableOpacity
                            key={notification.id}
                            style={[
                                styles.notificationCard,
                                !notification.read && styles.unreadCard
                            ]}
                            onPress={() => handleNotificationPress(notification)}
                        >
                            <View style={styles.notificationHeader}>
                                <View style={styles.iconContainer}>
                                    <Ionicons
                                        name={getNotificationIcon(notification.type)}
                                        size={24}
                                        color="#81171b"
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
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        lineHeight: 20,
    },
    notificationCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#81171b',
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconContainer: {
        marginRight: 12,
        marginTop: 2,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    notificationBody: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 8,
    },
    notificationTime: {
        fontSize: 12,
        color: '#999',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#81171b',
        marginLeft: 8,
        marginTop: 6,
    },
}); 