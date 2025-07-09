import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ToastNotificationProps {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
    onHide?: () => void;
}

const { width } = Dimensions.get('window');

export default function ToastNotification({
    visible,
    message,
    type,
    duration = 3000,
    onHide
}: ToastNotificationProps) {
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            showToast();
        } else {
            hideToast();
        }
    }, [visible]);

    const showToast = () => {
        setIsVisible(true);
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

        // Auto-hide after duration
        setTimeout(() => {
            hideToast();
        }, duration);
    };

    const hideToast = () => {
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
            onHide?.();
        });
    };

    const getToastStyle = () => {
        switch (type) {
            case 'success':
                return [styles.toast, styles.successToast];
            case 'error':
                return [styles.toast, styles.errorToast];
            case 'warning':
                return [styles.toast, styles.warningToast];
            default:
                return [styles.toast, styles.infoToast];
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success':
                return 'checkmark-circle';
            case 'error':
                return 'alert-circle';
            case 'warning':
                return 'warning';
            default:
                return 'information-circle';
        }
    };

    const getIconColor = () => {
        switch (type) {
            case 'success':
                return '#059669';
            case 'error':
                return '#dc2626';
            case 'warning':
                return '#f59e0b';
            default:
                return '#3b82f6';
        }
    };

    if (!isVisible) return null;

    return (
        <Animated.View
            style={[
                getToastStyle(),
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            <Ionicons name={getIcon()} size={20} color={getIconColor()} />
            <Text style={styles.message}>{message}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        zIndex: 1000,
    },
    successToast: {
        backgroundColor: '#f0fdf4',
        borderLeftWidth: 4,
        borderLeftColor: '#059669',
    },
    errorToast: {
        backgroundColor: '#fef2f2',
        borderLeftWidth: 4,
        borderLeftColor: '#dc2626',
    },
    warningToast: {
        backgroundColor: '#fffbeb',
        borderLeftWidth: 4,
        borderLeftColor: '#f59e0b',
    },
    infoToast: {
        backgroundColor: '#eff6ff',
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
    },
    message: {
        flex: 1,
        marginLeft: 12,
        fontSize: 14,
        fontWeight: '500',
        color: '#1f2937',
    },
}); 