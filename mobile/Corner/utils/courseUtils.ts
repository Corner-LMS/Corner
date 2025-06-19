import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/ firebase-config';
import { sendAnnouncementNotification } from './notifications';

export async function createAnnouncement(courseId: string, title: string, content: string) {
    try {
        // Add announcement to Firestore
        const announcementRef = await addDoc(collection(db, 'announcements'), {
            courseId,
            title,
            content,
            createdAt: serverTimestamp(),
        });

        // Send push notifications to all students in the course
        await sendAnnouncementNotification(courseId, title, content);

        return announcementRef.id;
    } catch (error) {
        console.error('Error creating announcement:', error);
        throw error;
    }
} 