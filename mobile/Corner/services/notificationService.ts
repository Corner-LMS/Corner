import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/ firebase-config';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
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

    async init() {
        await this.registerForPushNotificationsAsync();
        this.setupNotificationListeners();
    }

    private async registerForPushNotificationsAsync() {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#81171b',
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
                return null;
            }

            // Get the Expo push token
            try {
                const pushTokenString = (
                    await Notifications.getExpoPushTokenAsync({
                        projectId: Constants.expoConfig?.extra?.eas?.projectId,
                    })
                ).data;

                this.expoPushToken = pushTokenString;

                // Store token locally
                await AsyncStorage.setItem('expoPushToken', pushTokenString);

                return pushTokenString;
            } catch (error) {
                console.error('Error getting Expo push token:', error);
                return null;
            }
        } else {
            return null;
        }
    }

    private setupNotificationListeners() {
        // Handle notification received while app is foregrounded
        Notifications.addNotificationReceivedListener(notification => {
            // Notification received in foreground
        });

        // Handle notification response (when user taps notification)
        Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;

            // Handle navigation based on notification type
            if (data?.type === 'announcement' || data?.type === 'discussion_milestone' || data?.type === 'discussion_replies' || data?.type === 'teacher_discussion_milestone') {
                // Navigation logic can be added here
            }
        });
    }

    async getExpoPushToken(): Promise<string | null> {
        if (this.expoPushToken) {
            return this.expoPushToken;
        }

        // Try to get from AsyncStorage
        const storedToken = await AsyncStorage.getItem('expoPushToken');
        if (storedToken) {
            this.expoPushToken = storedToken;
            return storedToken;
        }

        // Register and get new token
        return await this.registerForPushNotificationsAsync();
    }

    async updateUserNotificationToken(userId: string) {
        const token = await this.getExpoPushToken();
        if (token) {
            try {
                await updateDoc(doc(db, 'users', userId), {
                    expoPushTokens: arrayUnion(token),
                    lastTokenUpdate: new Date()
                });
            } catch (error) {
                console.error('Error updating user notification token:', error);
            }
        }
    }

    async scheduleLocalNotification(notificationData: NotificationData) {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: notificationData.title,
                    body: notificationData.body,
                    data: notificationData.data || {},
                    sound: 'default',
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: 1
                },
            });
        } catch (error) {
            console.error('Error scheduling local notification:', error);
        }
    }

    // Send push notification (this would typically be called from your backend)
    async sendPushNotification(expoPushToken: string, notificationData: NotificationData) {
        try {
            const message = {
                to: expoPushToken,
                sound: 'default',
                title: notificationData.title,
                body: notificationData.body,
                data: notificationData.data || {},
                channelId: 'default',
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
            return result;
        } catch (error) {
            console.error('Error sending push notification:', error);
            throw error;
        }
    }
}

export const notificationService = new NotificationService(); 