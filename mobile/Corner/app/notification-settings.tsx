import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from './firebase/config';
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
                    setSettings({
                        ...settings,
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

            await updateDoc(doc(db, 'users', user.uid), {
                notificationSettings: settings,
                settingsUpdatedAt: new Date()
            });

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
                body: 'This is a test notification to check if everything is working!',
                data: { test: true }
            });
            Alert.alert('Test Notification', 'A test notification should appear shortly!');
            console.log('Test notification scheduled');
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
            Alert.alert('Success', 'All notifications cleared!');
            console.log('All notifications cleared for user:', user.uid);
        } catch (error) {
            console.error('Error clearing notifications:', error);
            Alert.alert('Error', 'Failed to clear notifications.');
        }
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
                    <Ionicons name="arrow-back" size={24} color="#81171b" />
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
                                    <Ionicons name="megaphone" size={20} color="#81171b" style={styles.settingIcon} />
                                    <View style={styles.settingText}>
                                        <Text style={styles.settingTitle}>Announcements</Text>
                                        <Text style={styles.settingSubtitle}>New announcements from teachers</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={settings.announcementNotifications}
                                    onValueChange={(value) => updateSetting('announcementNotifications', value)}
                                    trackColor={{ false: '#e0e0e0', true: '#81171b' }}
                                    thumbColor={settings.announcementNotifications ? '#fff' : '#f4f3f4'}
                                />
                            </View>

                            <View style={styles.settingItem}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="chatbubbles" size={20} color="#81171b" style={styles.settingIcon} />
                                    <View style={styles.settingText}>
                                        <Text style={styles.settingTitle}>Discussion Milestones</Text>
                                        <Text style={styles.settingSubtitle}>Every 10 new discussion posts</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={settings.discussionMilestoneNotifications}
                                    onValueChange={(value) => updateSetting('discussionMilestoneNotifications', value)}
                                    trackColor={{ false: '#e0e0e0', true: '#81171b' }}
                                    thumbColor={settings.discussionMilestoneNotifications ? '#fff' : '#f4f3f4'}
                                />
                            </View>

                            <View style={styles.settingItem}>
                                <View style={styles.settingInfo}>
                                    <Ionicons name="heart" size={20} color="#81171b" style={styles.settingIcon} />
                                    <View style={styles.settingText}>
                                        <Text style={styles.settingTitle}>Popular Discussions</Text>
                                        <Text style={styles.settingSubtitle}>When your posts get 3+ replies</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={settings.replyNotifications}
                                    onValueChange={(value) => updateSetting('replyNotifications', value)}
                                    trackColor={{ false: '#e0e0e0', true: '#81171b' }}
                                    thumbColor={settings.replyNotifications ? '#fff' : '#f4f3f4'}
                                />
                            </View>
                        </>
                    )}

                    {userRole === 'teacher' && (
                        <View style={styles.settingItem}>
                            <View style={styles.settingInfo}>
                                <Ionicons name="trending-up" size={20} color="#81171b" style={styles.settingIcon} />
                                <View style={styles.settingText}>
                                    <Text style={styles.settingTitle}>Course Activity</Text>
                                    <Text style={styles.settingSubtitle}>Every 10 discussion posts in your courses</Text>
                                </View>
                            </View>
                            <Switch
                                value={settings.teacherDiscussionMilestoneNotifications}
                                onValueChange={(value) => updateSetting('teacherDiscussionMilestoneNotifications', value)}
                                trackColor={{ false: '#e0e0e0', true: '#81171b' }}
                                thumbColor={settings.teacherDiscussionMilestoneNotifications ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notification Behavior</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="volume-high" size={20} color="#81171b" style={styles.settingIcon} />
                            <View style={styles.settingText}>
                                <Text style={styles.settingTitle}>Sound</Text>
                                <Text style={styles.settingSubtitle}>Play notification sounds</Text>
                            </View>
                        </View>
                        <Switch
                            value={settings.soundEnabled}
                            onValueChange={(value) => updateSetting('soundEnabled', value)}
                            trackColor={{ false: '#e0e0e0', true: '#81171b' }}
                            thumbColor={settings.soundEnabled ? '#fff' : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="phone-portrait" size={20} color="#81171b" style={styles.settingIcon} />
                            <View style={styles.settingText}>
                                <Text style={styles.settingTitle}>Vibration</Text>
                                <Text style={styles.settingSubtitle}>Vibrate for notifications</Text>
                            </View>
                        </View>
                        <Switch
                            value={settings.vibrationEnabled}
                            onValueChange={(value) => updateSetting('vibrationEnabled', value)}
                            trackColor={{ false: '#e0e0e0', true: '#81171b' }}
                            thumbColor={settings.vibrationEnabled ? '#fff' : '#f4f3f4'}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Test & Troubleshoot</Text>

                    <TouchableOpacity
                        style={styles.testButton}
                        onPress={testNotification}
                    >
                        <Ionicons name="notifications" size={20} color="#81171b" />
                        <Text style={styles.testButtonText}>Send Test Notification</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.testButton, { marginTop: 12 }]}
                        onPress={clearAllNotifications}
                    >
                        <Ionicons name="trash" size={20} color="#81171b" />
                        <Text style={styles.testButtonText}>Clear All Notifications</Text>
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
        paddingHorizontal: 24,
        paddingVertical: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(129, 23, 27, 0.08)',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        textAlign: 'center',
        letterSpacing: -0.5,
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
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    sectionTitle: {
        fontSize: 19,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    sectionDescription: {
        fontSize: 15,
        color: '#64748b',
        marginBottom: 20,
        lineHeight: 22,
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
        marginBottom: 4,
        lineHeight: 22,
    },
    settingSubtitle: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#fecaca',
        marginVertical: 6,
    },
    testButtonText: {
        fontSize: 16,
        color: '#81171b',
        fontWeight: '600',
        marginLeft: 10,
        letterSpacing: 0.3,
    },
    saveButton: {
        backgroundColor: '#81171b',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 32,
        shadowColor: '#81171b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
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
}); 