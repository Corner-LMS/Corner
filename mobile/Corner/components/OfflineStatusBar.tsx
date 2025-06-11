import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface OfflineStatusBarProps {
    showWhenOnline?: boolean;
}

export default function OfflineStatusBar({ showWhenOnline = false }: OfflineStatusBarProps) {
    const { isOnline, hasReconnected } = useNetworkStatus();

    // Don't show anything if online and showWhenOnline is false
    if (isOnline && !showWhenOnline && !hasReconnected) {
        return null;
    }

    // Show reconnection message briefly
    if (hasReconnected) {
        return (
            <View style={[styles.container, styles.reconnectedContainer]}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={[styles.text, styles.reconnectedText]}>
                    Back online - Data synced
                </Text>
            </View>
        );
    }

    // Show offline status
    if (!isOnline) {
        return (
            <View style={[styles.container, styles.offlineContainer]}>
                <Ionicons name="cloud-offline" size={16} color="#f59e0b" />
                <Text style={[styles.text, styles.offlineText]}>
                    You're offline - Showing cached content
                </Text>
            </View>
        );
    }

    // Show online status if requested
    if (showWhenOnline && isOnline) {
        return (
            <View style={[styles.container, styles.onlineContainer]}>
                <Ionicons name="cloud-done" size={16} color="#059669" />
                <Text style={[styles.text, styles.onlineText]}>
                    Online
                </Text>
            </View>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 8,
        borderRadius: 8,
    },
    text: {
        fontSize: 14,
        marginLeft: 8,
        fontWeight: '500',
    },
    offlineContainer: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    offlineText: {
        color: '#92400e',
    },
    onlineContainer: {
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(5, 150, 105, 0.2)',
    },
    onlineText: {
        color: '#065f46',
    },
    reconnectedContainer: {
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(5, 150, 105, 0.2)',
    },
    reconnectedText: {
        color: '#065f46',
    },
}); 