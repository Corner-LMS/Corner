import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

export default function MessageDetailScreen() {
    const params = useLocalSearchParams();
    const messageId = params.messageId as string;
    const senderName = params.senderName as string;
    const subject = params.subject as string;
    const content = params.content as string;
    const timestamp = params.timestamp as string;
    const courseName = params.courseName as string;

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const handleReply = () => {
        router.push({
            pathname: '/compose-message',
            params: {
                userId: '', // You'll need to get the sender's ID
                userName: senderName,
                subject: `Re: ${subject}`,
                courseName: courseName
            }
        });
    };

    const getInitials = (name: string) => {
        const nameParts = name.trim().split(' ');
        if (nameParts.length >= 2) {
            return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        } else {
            return name.substring(0, 2).toUpperCase();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>Message</Text>

                    <TouchableOpacity
                        style={styles.replyButton}
                        onPress={handleReply}
                    >
                        <Ionicons name="arrow-undo" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content}>
                {/* Message Header */}
                <View style={styles.messageHeader}>
                    <View style={styles.senderInfo}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {getInitials(senderName)}
                            </Text>
                        </View>
                        <View style={styles.senderDetails}>
                            <Text style={styles.senderName}>{senderName}</Text>
                            <Text style={styles.timestamp}>
                                {formatTimestamp(timestamp)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Subject */}
                <View style={styles.subjectSection}>
                    <Text style={styles.subject}>{subject}</Text>
                </View>

                {/* Course Context (if applicable) */}
                {courseName && courseName !== 'N/A' && courseName.trim() !== '' && (
                    <View style={styles.courseContext}>
                        <Ionicons name="school" size={16} color="#4f46e5" />
                        <Text style={styles.courseContextText}>
                            {courseName.includes('Course:') ? courseName : `Student's Course: ${courseName}`}
                        </Text>
                    </View>
                )}

                {/* Message Content */}
                <View style={styles.contentSection}>
                    <Text style={styles.messageContent}>{content}</Text>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleReply}
                    >
                        <Ionicons name="arrow-undo" size={20} color="#4f46e5" />
                        <Text style={styles.actionButtonText}>Reply</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => router.push('/compose-message')}
                    >
                        <Ionicons name="create" size={20} color="#4f46e5" />
                        <Text style={styles.actionButtonText}>New Message</Text>
                    </TouchableOpacity>
                </View>
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
        paddingTop: 0,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    replyButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    messageHeader: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    senderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    senderDetails: {
        flex: 1,
    },
    senderName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: 4,
    },
    timestamp: {
        fontSize: 14,
        color: '#64748b',
    },
    subjectSection: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    subject: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a202c',
        lineHeight: 28,
    },
    courseContext: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#0ea5e9',
    },
    courseContextText: {
        fontSize: 16,
        color: '#0c4a6e',
        fontWeight: '500',
        marginLeft: 8,
    },
    contentSection: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    messageContent: {
        fontSize: 16,
        color: '#1a202c',
        lineHeight: 24,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 40,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4f46e5',
        marginLeft: 8,
    },
}); 