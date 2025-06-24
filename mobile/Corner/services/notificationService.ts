import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/ firebase-config';
import { doc, updateDoc, getDoc, getDocs, query, collection, where } from 'firebase/firestore';

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
    constructor() {
        this.setupNotificationListeners();
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

    async scheduleLocalNotification(notificationData: NotificationData) {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: notificationData.title,
                    body: notificationData.body,
                    data: { ...notificationData },
                    sound: 'default',
                },
                trigger: null, // Send immediately
            });
        } catch (error) {
            console.error('Error scheduling local notification:', error);
            throw error;
        }
    }
}

export const notificationService = new NotificationService(); 