import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/ firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { notificationService } from '../services/notificationService';
import { notificationHelpers } from '../services/notificationHelpers';

interface NotificationSettings {
    announcementNotifications: boolean;
    discussionMilestoneNotifications: boolean;
    replyNotifications: boolean;
    teacherDiscussionMilestoneNotifications: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
}

const faqs = [
    {
        question: "How do notifications work?",
        answer: "You'll receive notifications for new announcements, discussion milestones, and replies based on your settings. Make sure to enable notifications for the app in your device settings."
    },
    {
        question: "Why am I not receiving notifications?",
        answer: "First, check if notifications are enabled in your device settings. Then, verify that the specific notification type is enabled in these settings. If issues persist, try the 'Test Notification' button."
    },
    {
        question: "How do I manage notification sounds?",
        answer: "You can toggle notification sounds using the 'Sound' switch in these settings. When enabled, you'll hear a sound for each notification."
    },
    {
        question: "Can I clear all notifications?",
        answer: "Yes, you can clear all notifications by tapping the 'Clear All Notifications' button at the bottom of this screen."
    }
];

export default function NotificationSettingsScreen() {
    const [settings, setSettings] = useState<NotificationSettings>({
        announcementNotifications: true,
        discussionMilestoneNotifications: true,
        replyNotifications: true,
        teacherDiscussionMilestoneNotifications: true,
        soundEnabled: true,
        vibrationEnabled: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userRole, setUserRole] = useState<string>('student');

    useEffect(() => {
        loadNotificationSettings();
    }, []);

    const loadNotificationSettings = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();

            if (userData) {
                // Set user role
                setUserRole(userData.role || 'student');

                // Load notification settings
                if (userData.notificationSettings) {
                    // Create a new settings object with default values
                    const defaultSettings: NotificationSettings = {
                        announcementNotifications: true,
                        discussionMilestoneNotifications: true,
                        replyNotifications: true,
                        teacherDiscussionMilestoneNotifications: true,
                        soundEnabled: true,
                        vibrationEnabled: true,
                    };

                    // Override defaults with saved settings
                    setSettings({
                        ...defaultSettings,
                        ...userData.notificationSettings
                    });
                }
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveNotificationSettings = async () => {
        setSaving(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'You must be logged in.');
                return;
            }

            // Save settings to Firestore
            await updateDoc(doc(db, 'users', user.uid), {
                notificationSettings: settings,
                settingsUpdatedAt: new Date()
            });

            // Update local state to ensure consistency
            setSettings(prevSettings => ({ ...prevSettings }));

            Alert.alert('Success', 'Notification settings saved!');
        } catch (error) {
            console.error('Error saving notification settings:', error);
            Alert.alert('Error', 'Failed to save settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const testNotification = async () => {
        try {
            await notificationService.scheduleLocalNotification({
                type: 'announcement',
                courseId: 'test',
                courseName: 'Test Course',
                title: 'Test Notification',
                body: 'This is a test notification to verify your settings work correctly.',
                data: { test: true }
            });
            Alert.alert('Success', 'Test notification sent! Check your notification tray.');
        } catch (error) {
            console.error('Error sending test notification:', error);
            Alert.alert('Error', 'Failed to send test notification.');
        }
    };

    const clearAllNotifications = async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'You must be logged in.');
                return;
            }

            await notificationHelpers.clearUserNotifications(user.uid);
            Alert.alert('Success', 'All notifications have been cleared.');
        } catch (error) {
            console.error('Error clearing notifications:', error);
            Alert.alert('Error', 'Failed to clear notifications.');
        }
    };

    const handleContactSupport = () => {
        Linking.openURL('mailto:support@corner.com');
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading settings...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notification Settings</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Content Notifications</Text>
                    <Text style={styles.sectionDescription}>
                        Get notified about important course activities
                    </Text>

                    {userRole === 'student' && (
                        <>
                            <View style={styles.settingItem}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="megaphone" size={20} color="#4f46e5" style={styles.settingIcon} />
                                    <View style={styles.settingText}>
                                        <Text style={styles.settingTitle}>Announcements</Text>
                                        <Text style={styles.settingSubtitle}>New announcements from teachers</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={settings.announcementNotifications}
                                    onValueChange={(value) => updateSetting('announcementNotifications', value)}
                                    trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
                                    thumbColor={settings.announcementNotifications ? '#fff' : '#f4f3f4'}
                                />
                            </View>

                            <View style={styles.settingItem}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="chatbubbles" size={20} color="#4f46e5" style={styles.settingIcon} />
                                    <View style={styles.settingText}>
                                        <Text style={styles.settingTitle}>Discussion Milestones</Text>
                                        <Text style={styles.settingSubtitle}>Every 10 new discussion posts</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={settings.discussionMilestoneNotifications}
                                    onValueChange={(value) => updateSetting('discussionMilestoneNotifications', value)}
                                    trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
                                    thumbColor={settings.discussionMilestoneNotifications ? '#fff' : '#f4f3f4'}
                                />
                            </View>

                            <View style={styles.settingItem}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="heart" size={20} color="#4f46e5" style={styles.settingIcon} />
                                    <View style={styles.settingText}>
                                        <Text style={styles.settingTitle}>Popular Discussions</Text>
                                        <Text style={styles.settingSubtitle}>When your posts get 3+ replies</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={settings.replyNotifications}
                                    onValueChange={(value) => updateSetting('replyNotifications', value)}
                                    trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
                                    thumbColor={settings.replyNotifications ? '#fff' : '#f4f3f4'}
                                />
                            </View>
                        </>
                    )}

                    {userRole === 'teacher' && (
                        <View style={styles.settingItem}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="trending-up" size={20} color="#4f46e5" style={styles.settingIcon} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingTitle}>Course Activity</Text>
                                    <Text style={styles.settingSubtitle}>Every 10 discussion posts in your courses</Text>
                                </View>
                            </View>
                            <Switch
                                value={settings.teacherDiscussionMilestoneNotifications}
                                onValueChange={(value) => updateSetting('teacherDiscussionMilestoneNotifications', value)}
                                trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
                                thumbColor={settings.teacherDiscussionMilestoneNotifications ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notification Behavior</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="volume-high" size={20} color="#4f46e5" style={styles.settingIcon} />
                            <View style={styles.settingText}>
                                <Text style={styles.settingTitle}>Sound</Text>
                                <Text style={styles.settingSubtitle}>Play notification sounds</Text>
                            </View>
                        </View>
                        <Switch
                            value={settings.soundEnabled}
                            onValueChange={(value) => updateSetting('soundEnabled', value)}
                            trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
                            thumbColor={settings.soundEnabled ? '#fff' : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="phone-portrait" size={20} color="#4f46e5" style={styles.settingIcon} />
                            <View style={styles.settingText}>
                                <Text style={styles.settingTitle}>Vibration</Text>
                                <Text style={styles.settingSubtitle}>Vibrate for notifications</Text>
                            </View>
                        </View>
                        <Switch
                            value={settings.vibrationEnabled}
                            onValueChange={(value) => updateSetting('vibrationEnabled', value)}
                            trackColor={{ false: '#e0e0e0', true: '#4f46e5' }}
                            thumbColor={settings.vibrationEnabled ? '#fff' : '#f4f3f4'}
                        />
                    </View>
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.testButton]}
                        onPress={testNotification}
                    >
                        <Ionicons name="notifications-outline" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Test Notification</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.clearButton]}
                        onPress={clearAllNotifications}
                    >
                        <Ionicons name="trash-outline" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Clear All Notifications</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.supportButton]}
                        onPress={() => router.push('/support')}
                    >
                        <Ionicons name="help-circle-outline" size={20} color="#fff" />
                        <Text style={styles.buttonText}>Help & Support</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.buttonDisabled]}
                    onPress={saveNotificationSettings}
                    disabled={saving}
                >
                    <Text style={styles.saveButtonText}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    loadingText: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '500',
    },
    header: {
        flexDirection: 'row',
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
    backButton: {
        padding: 8,
        marginRight: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    sectionDescription: {
        fontSize: 15,
        color: '#64748b',
        marginBottom: 24,
        lineHeight: 22,
        fontWeight: '500',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingIcon: {
        marginRight: 16,
        width: 24,
        textAlign: 'center',
    },
    settingText: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 6,
        lineHeight: 22,
    },
    settingSubtitle: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        fontWeight: '500',
    },
    testButton: {
        backgroundColor: '#4f46e5',
    },
    testButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '700',
        marginLeft: 12,
        letterSpacing: 0.3,
    },
    saveButton: {
        backgroundColor: '#4f46e5',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 32,
        marginBottom: 40,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    buttonDisabled: {
        opacity: 0.6,
        shadowOpacity: 0.1,
    },
    faqItem: {
        marginBottom: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    question: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 8,
    },
    answer: {
        fontSize: 15,
        color: '#64748b',
        lineHeight: 22,
    },
    buttonContainer: {
        padding: 16,
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    clearButton: {
        backgroundColor: '#ef4444',
    },
    supportButton: {
        backgroundColor: '#0ea5e9',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
}); 