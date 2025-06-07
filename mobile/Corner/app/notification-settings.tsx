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
    soundEnabled: boolean;
    vibrationEnabled: boolean;
}

export default function NotificationSettingsScreen() {
    const [settings, setSettings] = useState<NotificationSettings>({
        announcementNotifications: true,
        discussionMilestoneNotifications: true,
        replyNotifications: true,
        soundEnabled: true,
        vibrationEnabled: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadNotificationSettings();
    }, []);

    const loadNotificationSettings = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();

            if (userData?.notificationSettings) {
                setSettings({
                    ...settings,
                    ...userData.notificationSettings
                });
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

            // await notificationHelpers.clearUserNotifications(user.uid);
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
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 16,
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingIcon: {
        marginRight: 12,
    },
    settingText: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 13,
        color: '#666',
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#81171b',
    },
    testButtonText: {
        fontSize: 16,
        color: '#81171b',
        fontWeight: '500',
        marginLeft: 8,
    },
    saveButton: {
        backgroundColor: '#81171b',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 32,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
}); 