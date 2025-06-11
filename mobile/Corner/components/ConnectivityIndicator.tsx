import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface ConnectivityIndicatorProps {
    size?: 'small' | 'medium' | 'large';
    showText?: boolean;
    style?: any;
}

export default function ConnectivityIndicator({
    size = 'medium',
    showText = false,
    style
}: ConnectivityIndicatorProps) {
    const { isOnline, hasReconnected } = useNetworkStatus();

    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return {
                    container: styles.smallContainer,
                    dot: styles.smallDot,
                    text: styles.smallText,
                    icon: 12
                };
            case 'large':
                return {
                    container: styles.largeContainer,
                    dot: styles.largeDot,
                    text: styles.largeText,
                    icon: 20
                };
            default:
                return {
                    container: styles.mediumContainer,
                    dot: styles.mediumDot,
                    text: styles.mediumText,
                    icon: 16
                };
        }
    };

    const sizeStyles = getSizeStyles();

    // Show reconnection success briefly
    if (hasReconnected) {
        return (
            <View style={[sizeStyles.container, styles.reconnectedContainer, style]}>
                <Ionicons name="checkmark-circle" size={sizeStyles.icon} color="#059669" />
                {showText && (
                    <Text style={[sizeStyles.text, styles.reconnectedText]}>
                        Back online
                    </Text>
                )}
            </View>
        );
    }

    return (
        <View style={[sizeStyles.container, style]}>
            {/* Connection Status Dot */}
            <View style={[
                sizeStyles.dot,
                isOnline ? styles.onlineDot : styles.offlineDot
            ]} />

            {/* Optional Status Text */}
            {showText && (
                <Text style={[
                    sizeStyles.text,
                    isOnline ? styles.onlineText : styles.offlineText
                ]}>
                    {isOnline ? 'Online' : 'Offline'}
                </Text>
            )}

            {/* Connection Status Icon (alternative to dot) */}
            {!showText && (
                <Ionicons
                    name={isOnline ? "wifi" : "wifi-off"}
                    size={sizeStyles.icon}
                    color={isOnline ? "#059669" : "#ef4444"}
                    style={styles.icon}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // Container styles
    smallContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
    },
    mediumContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    largeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },

    // Dot styles
    smallDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4,
    },
    mediumDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    largeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },

    // Status colors
    onlineDot: {
        backgroundColor: '#059669',
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    offlineDot: {
        backgroundColor: '#ef4444',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },

    // Text styles
    smallText: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    mediumText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    largeText: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.3,
    },

    // Text colors
    onlineText: {
        color: '#059669',
    },
    offlineText: {
        color: '#ef4444',
    },

    // Reconnection styles
    reconnectedContainer: {
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(5, 150, 105, 0.2)',
    },
    reconnectedText: {
        color: '#059669',
        marginLeft: 4,
    },

    // Icon styles
    icon: {
        marginLeft: 2,
    },
}); 