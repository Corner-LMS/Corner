import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/ firebase-config';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, getDocs, query, collection, where } from 'firebase/firestore';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
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

class NotificationService {
    private expoPushToken: string | null = null;

    constructor() {
        this.setupNotificationListeners();
    }

    async init() {
        try {
            // Register for push notifications
            const token = await this.registerForPushNotifications();
            if (token) {
                // Store token locally
                await AsyncStorage.setItem('expoPushToken', token.data);
                this.expoPushToken = token.data;
            }
        } catch (error) {
            console.error('Error initializing notification service:', error);
        }
    }

    async updateUserNotificationToken(userId: string) {
        try {
            const token = await this.registerForPushNotifications();
            if (token) {
                await this.savePushToken(userId, token.data);
            }
        } catch (error) {
            console.error('Error updating user notification token:', error);
        }
    }

    async registerForPushNotifications() {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#4f46e5',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }

            // Get the token that uniquely identifies this device
            token = await Notifications.getExpoPushTokenAsync({
                projectId: Constants.expoConfig?.extra?.eas?.projectId,
            });
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    }

    async savePushToken(userId: string, token: string) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                expoPushTokens: arrayUnion(token)
            });

            // Store token locally
            await AsyncStorage.setItem('expoPushToken', token);
            this.expoPushToken = token;
        } catch (error) {
            console.error('Error saving push token:', error);
        }
    }

    private async shouldSendNotification(userId: string, notificationType: string): Promise<boolean> {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            const userData = userDoc.data();
            
            if (!userData?.notificationSettings) {
                return true; // Default to true if settings don't exist
            }

            const settings = userData.notificationSettings;
            
            switch (notificationType) {
                case 'announcement':
                    return settings.announcementNotifications;
                case 'discussion_milestone':
                    return settings.discussionMilestoneNotifications;
                case 'discussion_replies':
                    return settings.replyNotifications;
                case 'teacher_discussion_milestone':
                    return settings.teacherDiscussionMilestoneNotifications;
                default:
                    return true;
            }
        } catch (error) {
            console.error('Error checking notification settings:', error);
            return true; // Default to true if there's an error
        }
    }

    async sendPushNotification(token: string, notificationData: NotificationData) {
        try {
            // Get user ID from token mapping or notification data
            const userDoc = await getDocs(query(collection(db, 'users'), where('expoPushTokens', 'array-contains', token)));
            if (userDoc.empty) {
                console.error('No user found for token');
                return;
            }

            const userId = userDoc.docs[0].id;
            
            // Check if notification should be sent based on user settings
            const shouldSend = await this.shouldSendNotification(userId, notificationData.type);
            if (!shouldSend) {
                console.log('Notification blocked by user settings:', notificationData.type);
                return;
            }

            const message = {
                to: token,
                sound: 'default',
                title: notificationData.title,
                body: notificationData.body,
                data: notificationData,
                badge: 1,
                priority: 'high',
                channelId: 'default',
            };

            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    }

    private setupNotificationListeners() {
        // Handle notification received while app is foregrounded
        Notifications.addNotificationReceivedListener(notification => {
            // You can handle the notification here if needed
            console.log('Notification received:', notification);
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

    async removePushToken(userId: string, token: string) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                expoPushTokens: arrayRemove(token)
            });

            // Remove token locally
            await AsyncStorage.removeItem('expoPushToken');
            this.expoPushToken = null;
        } catch (error) {
            console.error('Error removing push token:', error);
        }
    }
}

export const notificationService = new NotificationService(); 