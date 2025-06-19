import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/ firebase-config';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true
    }),
});

// Register for push notifications
export async function registerForPushNotifications() {
    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            throw new Error('Permission not granted for notifications');
        }

        const token = (await Notifications.getExpoPushTokenAsync({
            projectId: 'a9633406-bbb5-465d-bbbc-52a881060345', // Your Expo project ID
        })).data;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        return token;
    } catch (error) {
        console.error('Error registering for push notifications:', error);
        throw error;
    }
}

// Send announcement notification to all students in a course
export async function sendAnnouncementNotification(courseId: string, announcementTitle: string, announcementContent: string) {
    try {
        // Get all students in the course
        const studentsQuery = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('enrolledCourses', 'array-contains', courseId)
        );

        const studentsSnapshot = await getDocs(studentsQuery);
        const pushTokens: string[] = [];

        // Collect all push tokens
        studentsSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.pushToken) {
                pushTokens.push(userData.pushToken);
            }
        });

        // Send notifications to all students
        const messages = pushTokens.map(token => ({
            to: token,
            sound: 'default',
            title: `New Announcement: ${announcementTitle}`,
            body: announcementContent,
            data: {
                type: 'announcement',
                courseId,
            },
        }));

        // Send notifications in batches of 100 (Expo's limit)
        const batchSize = 100;
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            await Promise.all(
                batch.map(message =>
                    fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(message),
                    })
                )
            );
        }
    } catch (error) {
        console.error('Error sending announcement notifications:', error);
        throw error;
    }
} 