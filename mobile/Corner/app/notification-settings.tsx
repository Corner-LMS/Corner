import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { notificationService } from '../services/notificationService';
import { notificationHelpers } from '../services/notificationHelpers';
import { LinearGradient } from 'expo-linear-gradient';
import CustomAlert from '../components/CustomAlert';

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
    const [alertConfig, setAlertConfig] = useState<any>(null);

    useEffect(() => {
        loadNotificationSettings();
    }, []);

    const loadNotificationSettings = async () => {
        try {
            const user = auth().currentUser;
            if (!user) return;

            const userDoc = await firestore().collection('users').doc(user.uid).get();
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
            const user = auth().currentUser;
            if (!user) {
                setAlertConfig({
                    visible: true,
                    title: 'Error',
                    message: 'You must be logged in.',
                    type: 'error',
                    actions: [
                        {
                            text: 'OK',
                            onPress: () => setAlertConfig(null),
                            style: 'primary',
                        },
                    ],
                });
                return;
            }

            // Save settings to Firestore
            await firestore().collection('users').doc(user.uid).update({
                notificationSettings: settings,
                settingsUpdatedAt: new Date()
            });

            // Update local state to ensure consistency
            setSettings(prevSettings => ({ ...prevSettings }));

            setAlertConfig({
                visible: true,
                title: 'Success',
                message: 'Notification settings saved!',
                type: 'success',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
        } catch (error) {
            console.error('Error saving notification settings:', error);
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to save settings. Please try again.',
                type: 'error',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => setAlertConfig(null),
                        style: 'primary',
                    },
                ],
            });
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

    const clearAllNotifications = async () => {
        setAlertConfig({
            visible: true,
            title: 'Clear All Notifications',
            message: 'Are you sure you want to clear all your notifications? This action cannot be undone.',
            type: 'warning',
            actions: [
                {
                    text: 'Cancel',
                    onPress: () => setAlertConfig(null),
                    style: 'cancel',
                },
                {
                    text: 'Clear All',
                    onPress: async () => {
                        setAlertConfig(null);
                        try {
                            const user = auth().currentUser;
                            if (!user) {
                                setAlertConfig({
                                    visible: true,
                                    title: 'Error',
                                    message: 'You must be logged in.',
                                    type: 'error',
                                    actions: [
                                        {
                                            text: 'OK',
                                            onPress: () => setAlertConfig(null),
                                            style: 'primary',
                                        },
                                    ],
                                });
                                return;
                            }

                            await notificationHelpers.clearUserNotifications(user.uid);
                            setAlertConfig({
                                visible: true,
                                title: 'Success',
                                message: 'All notifications have been cleared.',
                                type: 'success',
                                actions: [
                                    {
                                        text: 'OK',
                                        onPress: () => setAlertConfig(null),
                                        style: 'primary',
                                    },
                                ],
                            });
                        } catch (error) {
                            console.error('Error clearing notifications:', error);
                            setAlertConfig({
                                visible: true,
                                title: 'Error',
                                message: 'Failed to clear notifications.',
                                type: 'error',
                                actions: [
                                    {
                                        text: 'OK',
                                        onPress: () => setAlertConfig(null),
                                        style: 'primary',
                                    },
                                ],
                            });
                        }
                    },
                    style: 'destructive',
                },
            ],
        });
    };

    const handleContactSupport = () => {
        Linking.openURL('mailto:corner.e.learning@gmail.com');
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
                    <Text style={styles.headerTitle}>Notification Settings</Text>
                    <View style={styles.headerSpacer} />
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading settings...</Text>
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
                <Text style={styles.headerTitle}>Notification Settings</Text>
                <TouchableOpacity onPress={clearAllNotifications} style={styles.headerClearButton}>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.content}>
                {/* Save Notice */}
                <View style={styles.saveNotice}>
                    <Ionicons name="information-circle" size={20} color="#4f46e5" />
                    <Text style={styles.saveNoticeText}>
                        Don't forget to save your settings at the bottom of this screen for changes to take effect.
                    </Text>
                </View>

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
                                    trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
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
                                    trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
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
                                    trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
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
                                trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
                                thumbColor={settings.teacherDiscussionMilestoneNotifications ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.supportButton]}
                        onPress={() => router.push('/support')}
                    >
                        <LinearGradient
                            colors={['#0ea5e9', '#0284c7']}
                            style={styles.buttonGradient}
                        >
                            <Ionicons name="help-circle-outline" size={20} color="#fff" />
                            <Text style={styles.buttonText}>Help & Support</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.buttonDisabled]}
                    onPress={saveNotificationSettings}
                    disabled={saving}
                >
                    <LinearGradient
                        colors={saving ? ['#94a3b8', '#64748b'] : ['#4f46e5', '#3730a3']}
                        style={styles.saveButtonGradient}
                    >
                        <Text style={styles.saveButtonText}>
                            {saving ? 'Saving...' : 'Save Settings'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>

            <CustomAlert
                visible={alertConfig?.visible || false}
                title={alertConfig?.title || ''}
                message={alertConfig?.message || ''}
                type={alertConfig?.type || 'info'}
                actions={alertConfig?.actions || []}
                onDismiss={() => setAlertConfig(null)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
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
        paddingTop: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 24,
    },
    headerClearButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    saveNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    saveNoticeText: {
        fontSize: 14,
        color: '#1e40af',
        marginLeft: 12,
        fontWeight: '500',
        lineHeight: 20,
        flex: 1,
    },
    section: {
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 20,
        lineHeight: 20,
        fontWeight: '500',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingIcon: {
        marginRight: 12,
        width: 24,
        textAlign: 'center',
    },
    settingText: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: 4,
        lineHeight: 20,
    },
    settingSubtitle: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
        fontWeight: '500',
    },
    buttonContainer: {
        gap: 12,
        marginBottom: 20,
    },
    button: {
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    testButton: {
        // Gradient handled by buttonGradient
    },
    clearButton: {
        // Gradient handled by buttonGradient
    },
    supportButton: {
        // Gradient handled by buttonGradient
    },
    buttonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    saveButton: {
        borderRadius: 16,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        marginBottom: 40,
    },
    saveButtonGradient: {
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    buttonDisabled: {
        shadowOpacity: 0.1,
    },
}); 