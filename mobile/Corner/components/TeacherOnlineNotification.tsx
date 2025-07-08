import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { presenceService, PresenceNotification } from '../services/presenceService';

interface TeacherOnlineNotificationProps {
    style?: any;
}

export default function TeacherOnlineNotification({ style }: TeacherOnlineNotificationProps) {
    const [notification, setNotification] = useState<PresenceNotification | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Register for teacher online notifications
        const unsubscribe = presenceService.onTeacherOnline((notificationData) => {
            showNotification(notificationData);
        });

        return () => {
            unsubscribe();
            if (dismissTimeoutRef.current) {
                clearTimeout(dismissTimeoutRef.current);
            }
        };
    }, []);

    const showNotification = (notificationData: PresenceNotification) => {
        // Clear any existing timeout
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
        }

        setNotification(notificationData);
        setIsVisible(true);

        // Animate in
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-dismiss after 5 seconds
        dismissTimeoutRef.current = setTimeout(() => {
            dismissNotification();
        }, 5000);
    };

    const dismissNotification = () => {
        // Animate out
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setIsVisible(false);
            setNotification(null);
            slideAnim.setValue(-100);
            opacityAnim.setValue(0);
        });

        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }
    };

    const handlePress = () => {
        // Could navigate to course or do other actions
        dismissNotification();
    };

    if (!isVisible || !notification) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.container,
                style,
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                }
            ]}
        >
            <TouchableOpacity
                style={styles.notificationContent}
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <View style={styles.leftSection}>
                    {/* Online indicator */}
                    <View style={styles.onlineIndicator}>
                        <View style={styles.onlineDot} />
                        <Ionicons name="person" size={16} color="#4f46e5" />
                    </View>

                    {/* Notification text */}
                    <View style={styles.textSection}>
                        <Text style={styles.titleText}>
                            {notification.teacherName} is online
                        </Text>
                        <Text style={styles.subtitleText}>
                            {notification.courseName}
                        </Text>
                    </View>
                </View>

                {/* Dismiss button */}
                <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={dismissNotification}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="close" size={18} color="#64748b" />
                </TouchableOpacity>
            </TouchableOpacity>

            {/* Progress bar for auto-dismiss */}
            <View style={styles.progressBarContainer}>
                <Animated.View style={[
                    styles.progressBar,
                    {
                        width: '100%', // Could animate this for countdown effect
                    }
                ]} />
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        zIndex: 1000,
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.1)',
        overflow: 'hidden',
    },
    notificationContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 12,
        marginRight: 12,
    },
    onlineDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#059669',
        marginRight: 6,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.4,
        shadowRadius: 2,
        elevation: 2,
    },
    textSection: {
        flex: 1,
    },
    titleText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 2,
        letterSpacing: -0.2,
    },
    subtitleText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    dismissButton: {
        padding: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
    },
    progressBarContainer: {
        height: 3,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#4f46e5',
        borderRadius: 2,
    },
}); 