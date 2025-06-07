import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../app/firebase/config';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { router } from 'expo-router';

interface NotificationBadgeProps {
    size?: 'small' | 'medium' | 'large';
    color?: string;
    onPress?: () => void;
}

export default function NotificationBadge({
    size = 'medium',
    color = '#81171b',
    onPress
}: NotificationBadgeProps) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasNewNotifications, setHasNewNotifications] = useState(false);

    const iconSizes = {
        small: 20,
        medium: 24,
        large: 28
    };

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Listen to user's notification data
        const unsubscribe = onSnapshot(
            doc(db, 'users', user.uid),
            (doc) => {
                const userData = doc.data();
                if (userData) {
                    const notificationData = userData.notificationData || {};
                    const unread = notificationData.unreadCount || 0;
                    const lastNotificationTime = notificationData.lastNotificationTime;
                    const lastSeenTime = notificationData.lastSeenTime;

                    setUnreadCount(unread);

                    // Check if there are new notifications since last seen
                    if (lastNotificationTime && lastSeenTime) {
                        setHasNewNotifications(lastNotificationTime > lastSeenTime);
                    } else if (unread > 0) {
                        setHasNewNotifications(true);
                    } else {
                        setHasNewNotifications(false);
                    }
                }
            },
            (error) => {
                console.error('Error listening to notification data:', error);
            }
        );

        return () => unsubscribe();
    }, []);

    const handlePress = async () => {
        if (onPress) {
            onPress();
        } else {
            // Default action: navigate to notifications list
            router.push('/notifications');
        }

        // Mark notifications as seen and clear unread count
        const user = auth.currentUser;
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    'notificationData.lastSeenTime': new Date(),
                    'notificationData.unreadCount': 0  // Clear the badge count when viewing notifications
                });
                setHasNewNotifications(false);
            } catch (error) {
                console.error('Error updating last seen time:', error);
            }
        }
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handlePress}>
            <View style={styles.iconContainer}>
                <Ionicons
                    name={unreadCount > 0 ? "notifications" : "notifications-outline"}
                    size={iconSizes[size]}
                    color={color}
                />

                {/* Badge with unread count */}
                {unreadCount > 0 && (
                    <View style={[styles.badge, hasNewNotifications && styles.pulseBadge]}>
                        <Text style={styles.badgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount.toString()}
                        </Text>
                    </View>
                )}

                {/* Animated dot for new notifications */}
                {hasNewNotifications && unreadCount === 0 && (
                    <View style={[styles.newNotificationDot]} />
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(129, 23, 27, 0.08)',
    },
    iconContainer: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: '#ef4444',
        borderRadius: 14,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6,
    },
    pulseBadge: {
        backgroundColor: '#dc2626',
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
        elevation: 8,
        transform: [{ scale: 1.1 }],
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    newNotificationDot: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
    },
}); 