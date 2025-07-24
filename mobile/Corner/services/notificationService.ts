import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Constants from 'expo-constants';

// Import StudentUser interface from notificationHelpers
interface StudentUser {
    id: string;
    name?: string;
    expoPushTokens?: string[];
    [key: string]: any;
}

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPresentAlert: true, // Show alert even when app is in foreground
        shouldPresentBadge: true, // Show badge even when app is in foreground
        shouldPresentSound: true, // Play sound even when app is in foreground
    }),
});

export interface NotificationData {
    type: 'announcement' | 'discussion_milestone' | 'discussion_replies' | 'teacher_discussion_milestone';
    courseId: string;
    courseName: string;
    title: string;
    body: string;
    data?: any;
}

interface PushNotificationMessage {
    to: string;
    sound: 'default' | null;
    title: string;
    body: string;
    data?: any;
    badge?: number;
}

class NotificationService {
    constructor() {
        this.setupNotificationListeners();
    }

    async initialize() {
        try {
            // Set up Android notification channel
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            // Request permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                return;
            }

            // Get push token
            if (Device.isDevice) {
                const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

                const token = await Notifications.getExpoPushTokenAsync({
                    projectId: projectId,
                });

                // Save token to user's document
                const user = auth().currentUser;
                if (user) {
                    await this.savePushToken(user.uid, token.data);
                }
            }

            // Set up notification categories (iOS)
            if (Platform.OS === 'ios') {
                await Notifications.setNotificationCategoryAsync('default', [
                    {
                        identifier: 'view',
                        buttonTitle: 'View',
                        options: {
                            isDestructive: false,
                            isAuthenticationRequired: false,
                        },
                    },
                ]);
            }
        } catch (error) {
            console.error('❌ [PUSH] Error initializing push notifications:', error);
        }
    }

    // Send push notification to a specific token
    async sendPushNotification(expoPushToken: string, notificationData: NotificationData, badgeCount?: number) {
        try {
            // Separate title and body from data to prevent Android silent notifications
            const { title, body, ...cleanedData } = notificationData;

            const message: PushNotificationMessage = {
                to: expoPushToken,
                sound: 'default',
                title,
                body,
                data: cleanedData, // title/body are not duplicated here
                ...(badgeCount !== undefined && { badge: badgeCount }),
            };

            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });

            const result = await response.json();

            if (response.ok) {
                return result;
            } else {
                throw new Error(`Push notification failed: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            console.error('❌ [PUSH] Error sending push notification:', error);
            throw error;
        }
    }

    // Send push notification to multiple tokens
    async sendPushNotificationToMultiple(tokens: string[], notificationData: NotificationData, badgeCount?: number) {
        try {
            // Separate title and body from data to prevent Android silent notifications
            const { title, body, ...cleanedData } = notificationData;

            const messages = tokens.map((token) => ({
                to: token,
                sound: 'default',
                title,
                body,
                data: cleanedData, // title/body are not duplicated here
                ...(badgeCount !== undefined && { badge: badgeCount }),
            }));

            const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            });

            const result = await response.json();

            if (response.ok) {
                return result;
            } else {
                throw new Error(`Multiple push notifications failed: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            console.error('❌ [PUSH] Error sending multiple push notifications:', error);
            throw error;
        }
    }

    // Send push notification to all students in a course
    async sendPushNotificationToCourse(courseId: string, notificationData: NotificationData, badgeCount?: number) {
        try {
            // Get all students in the course with their push tokens
            const studentsQuery = firestore().collection('users')
                .where('role', '==', 'student')
                .where('courseIds', 'array-contains', courseId);

            const studentsSnapshot = await studentsQuery.get();
            const students = studentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as StudentUser[];

            // Collect all valid push tokens
            const validTokens: string[] = [];
            const validStudents: StudentUser[] = [];

            for (const student of students) {
                if (student.expoPushTokens && student.expoPushTokens.length > 0) {
                    // Check notification settings
                    const shouldSend = await this.checkNotificationSettings(student.id, notificationData.type);
                    if (shouldSend) {
                        validTokens.push(...student.expoPushTokens);
                        validStudents.push(student);
                    }
                }
            }

            if (validTokens.length === 0) {
                return;
            }

            // Send push notifications with badge count
            const result = await this.sendPushNotificationToMultiple(validTokens, notificationData, badgeCount);

            return result;
        } catch (error) {
            console.error('❌ [PUSH] Error sending course push notifications:', error);
            throw error;
        }
    }

    // Check if user has notification settings enabled
    private async checkNotificationSettings(userId: string, notificationType: string): Promise<boolean> {
        try {
            const userDoc = await firestore().collection('users').doc(userId).get();
            const userData = userDoc.data();

            if (!userData?.notificationSettings) {
                return true; // Default to true if no settings
            }

            const settings = userData.notificationSettings;
            let shouldSend = false;

            switch (notificationType) {
                case 'announcement':
                    shouldSend = settings.announcementNotifications ?? true;
                    break;
                case 'discussion_milestone':
                    shouldSend = settings.discussionMilestoneNotifications ?? true;
                    break;
                case 'discussion_replies':
                    shouldSend = settings.replyNotifications ?? true;
                    break;
                case 'teacher_discussion_milestone':
                    shouldSend = settings.teacherDiscussionMilestoneNotifications ?? true;
                    break;
                default:
                    shouldSend = true;
            }

            return shouldSend;
        } catch (error) {
            console.error('❌ [PUSH] Error checking notification settings:', error);
            return true; // Default to true on error
        }
    }

    private async savePushToken(userId: string, token: string) {
        try {
            await firestore().collection('users').doc(userId).update({
                expoPushTokens: firestore.FieldValue.arrayUnion(token),
                lastTokenUpdate: new Date(),
            });
        } catch (error) {
            console.error('❌ [PUSH] Error saving push token:', error);
        }
    }

    async updatePushToken(userId: string) {
        try {
            if (Device.isDevice) {
                const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

                const token = await Notifications.getExpoPushTokenAsync({
                    projectId: projectId,
                });

                await this.savePushToken(userId, token.data);
            }
        } catch (error) {
            console.error('❌ [PUSH] Error updating push token:', error);
        }
    }

    private setupNotificationListeners() {
        // Handle notification received while app is foregrounded
        Notifications.addNotificationReceivedListener(notification => {
            // Handle foreground notifications if needed
        });

        // Handle notification response (when user taps notification)
        Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;

            // Handle navigation based on notification type
            if (data?.type === 'announcement') {
                // Navigate to announcement
                // router.push(`/course/${data.courseId}/announcements`);
            } else if (data?.type === 'discussion_milestone' || data?.type === 'discussion_replies') {
                // Navigate to discussion
                // router.push(`/course/${data.courseId}/discussions/${data.discussionId}`);
            }
        });
    }

    async scheduleLocalNotification(notificationData: NotificationData) {
        try {
            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: notificationData.title,
                    body: notificationData.body,
                    data: { ...notificationData },
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    vibrate: [0, 250, 250, 250],
                },
                trigger: null, // Send immediately
            });

            return notificationId;
        } catch (error) {
            console.error('❌ [PUSH] Error scheduling local notification:', error);
            throw error;
        }
    }

    // Show immediate local notification (guaranteed to show in foreground)
    async showImmediateNotification(notificationData: NotificationData) {
        try {
            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: notificationData.title,
                    body: notificationData.body,
                    data: { ...notificationData },
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    vibrate: [0, 250, 250, 250],
                    autoDismiss: false, // Don't auto-dismiss
                },
                trigger: null, // Send immediately
            });

            return notificationId;
        } catch (error) {
            console.error('❌ [PUSH] Error showing immediate notification:', error);
            throw error;
        }
    }
}

export const notificationService = new NotificationService(); 