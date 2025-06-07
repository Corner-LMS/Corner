import { db } from '../app/firebase/config';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    increment,
    serverTimestamp,
    addDoc
} from 'firebase/firestore';
import { notificationService, NotificationData } from './notificationService';

export interface NotificationTrigger {
    type: 'announcement' | 'discussion_milestone' | 'discussion_replies';
    courseId: string;
    triggeredBy: string; // userId who triggered the notification
    metadata?: any;
}

interface StudentUser {
    id: string;
    name?: string;
    expoPushTokens?: string[];
    [key: string]: any;
}

class NotificationHelpers {

    // Update user's notification badge count
    private async updateUserBadgeCount(userId: string, incrementBy: number = 1) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                'notificationData.unreadCount': incrementBy > 0 ?
                    increment(incrementBy) : 0,
                'notificationData.lastNotificationTime': new Date()
            });
        } catch (error) {
            console.error('Error updating user badge count:', error);
        }
    }

    // Send notification when teacher posts an announcement
    async notifyStudentsOfAnnouncement(courseId: string, announcementData: any, teacherId: string) {
        try {
            console.log('Triggering announcement notifications for course:', courseId);

            // Get all students in the course
            const students = await this.getStudentsInCourse(courseId);

            // Get course details
            const courseDoc = await getDoc(doc(db, 'courses', courseId));
            const courseData = courseDoc.data();
            const courseName = courseData?.name || 'Unknown Course';

            const notificationData: NotificationData = {
                type: 'announcement',
                courseId: courseId,
                courseName: courseName,
                title: `New Announcement in ${courseName}`,
                body: `${announcementData.title}`,
                data: {
                    type: 'announcement',
                    courseId: courseId,
                    announcementId: announcementData.id || 'unknown',
                    courseName: courseName
                }
            };

            // Send notifications to all students and update their badge counts
            const notificationPromises = students.map(async (student: StudentUser) => {
                // Save notification to Firestore
                await addDoc(collection(db, 'notifications'), {
                    userId: student.id,
                    type: 'announcement',
                    title: notificationData.title,
                    body: notificationData.body,
                    courseId: courseId,
                    courseName: courseName,
                    timestamp: serverTimestamp(),
                    read: false,
                    data: notificationData.data
                });

                // Update badge count
                await this.updateUserBadgeCount(student.id, 1);

                // Then send push notification if they have tokens
                if (student.expoPushTokens && student.expoPushTokens.length > 0) {
                    // Send to each token (user might have multiple devices)
                    return Promise.all(
                        student.expoPushTokens.map((token: string) =>
                            notificationService.sendPushNotification(token, notificationData)
                        )
                    );
                }
            });

            await Promise.all(notificationPromises);
            console.log(`Sent announcement notifications to ${students.length} students`);

            // Track notification in Firestore
            await this.logNotification({
                type: 'announcement',
                courseId: courseId,
                triggeredBy: teacherId,
                metadata: {
                    announcementTitle: announcementData.title,
                    studentCount: students.length
                }
            });

        } catch (error) {
            console.error('Error sending announcement notifications:', error);
        }
    }

    // Check and notify after every 10 discussion posts
    async checkDiscussionMilestone(courseId: string, newPostAuthorId: string) {
        try {
            console.log('Checking discussion milestone for course:', courseId);

            // Get total discussion count
            const discussionsQuery = query(collection(db, 'courses', courseId, 'discussions'));
            const discussionsSnapshot = await getDocs(discussionsQuery);
            const totalDiscussions = discussionsSnapshot.size;

            console.log('Total discussions:', totalDiscussions);

            // Check if we hit a milestone (every 10 posts)
            if (totalDiscussions > 0 && totalDiscussions % 10 === 0) {
                // Get all students in the course (except the one who just posted)
                const students = await this.getStudentsInCourse(courseId, newPostAuthorId);

                // Get course details
                const courseDoc = await getDoc(doc(db, 'courses', courseId));
                const courseData = courseDoc.data();
                const courseName = courseData?.name || 'Unknown Course';

                const notificationData: NotificationData = {
                    type: 'discussion_milestone',
                    courseId: courseId,
                    courseName: courseName,
                    title: `Active Discussion in ${courseName}`,
                    body: `${totalDiscussions} discussions and counting! Join the conversation.`,
                    data: {
                        type: 'discussion_milestone',
                        courseId: courseId,
                        courseName: courseName,
                        discussionCount: totalDiscussions
                    }
                };

                // Send notifications to all students and update their badge counts
                const notificationPromises = students.map(async (student: StudentUser) => {
                    // Save notification to Firestore
                    await addDoc(collection(db, 'notifications'), {
                        userId: student.id,
                        type: 'discussion_milestone',
                        title: notificationData.title,
                        body: notificationData.body,
                        courseId: courseId,
                        courseName: courseName,
                        timestamp: serverTimestamp(),
                        read: false,
                        data: notificationData.data
                    });

                    // Update badge count
                    await this.updateUserBadgeCount(student.id, 1);

                    // Then send push notification if they have tokens
                    if (student.expoPushTokens && student.expoPushTokens.length > 0) {
                        return Promise.all(
                            student.expoPushTokens.map((token: string) =>
                                notificationService.sendPushNotification(token, notificationData)
                            )
                        );
                    }
                });

                await Promise.all(notificationPromises);
                console.log(`Sent milestone notifications to ${students.length} students`);

                // Track notification
                await this.logNotification({
                    type: 'discussion_milestone',
                    courseId: courseId,
                    triggeredBy: newPostAuthorId,
                    metadata: {
                        milestone: totalDiscussions,
                        studentCount: students.length
                    }
                });
            }
        } catch (error) {
            console.error('Error checking discussion milestone:', error);
        }
    }

    // Notify when student's discussion post gets 3+ replies
    async checkDiscussionReplies(courseId: string, discussionId: string, newReplyAuthorId: string) {
        try {
            console.log('Checking discussion replies for notification:', discussionId);

            // Get discussion details
            const discussionDoc = await getDoc(doc(db, 'courses', courseId, 'discussions', discussionId));
            const discussionData = discussionDoc.data();

            if (!discussionData) return;

            const replies = discussionData.replies || 0;
            const originalAuthorId = discussionData.authorId;

            console.log('Discussion replies count:', replies);

            // Notify if we hit exactly 2 replies and the original author is a student
            if (replies === 5 && discussionData.authorRole === 'student' && originalAuthorId !== newReplyAuthorId) {
                // Get course details
                const courseDoc = await getDoc(doc(db, 'courses', courseId));
                const courseData = courseDoc.data();
                const courseName = courseData?.name || 'Unknown Course';

                const notificationData: NotificationData = {
                    type: 'discussion_replies',
                    courseId: courseId,
                    courseName: courseName,
                    title: `Your Discussion is Popular!`,
                    body: `Your post "${discussionData.title}" has received 3 replies in ${courseName}`,
                    data: {
                        type: 'discussion_replies',
                        courseId: courseId,
                        discussionId: discussionId,
                        courseName: courseName,
                        discussionTitle: discussionData.title
                    }
                };

                // Get the original discussion author's notification tokens
                const authorDoc = await getDoc(doc(db, 'users', originalAuthorId));
                const authorData = authorDoc.data();

                if (authorData) {
                    // Save notification to Firestore
                    await addDoc(collection(db, 'notifications'), {
                        userId: originalAuthorId,
                        type: 'discussion_replies',
                        title: notificationData.title,
                        body: notificationData.body,
                        courseId: courseId,
                        courseName: courseName,
                        timestamp: serverTimestamp(),
                        read: false,
                        data: notificationData.data
                    });

                    // Update badge count
                    await this.updateUserBadgeCount(originalAuthorId, 1);

                    // Then send push notification if they have tokens
                    if (authorData.expoPushTokens && authorData.expoPushTokens.length > 0) {
                        // Send notification to all author's devices
                        const notificationPromises = authorData.expoPushTokens.map((token: string) =>
                            notificationService.sendPushNotification(token, notificationData)
                        );

                        await Promise.all(notificationPromises);
                        console.log(`Sent reply notification to discussion author: ${authorData.name}`);
                    }

                    // Track notification
                    await this.logNotification({
                        type: 'discussion_replies',
                        courseId: courseId,
                        triggeredBy: newReplyAuthorId,
                        metadata: {
                            discussionId: discussionId,
                            discussionTitle: discussionData.title,
                            replyCount: replies,
                            notifiedUserId: originalAuthorId
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error checking discussion replies:', error);
        }
    }

    // Clear all notifications for a user (when they view notifications)
    async clearUserNotifications(userId: string) {
        try {
            await this.updateUserBadgeCount(userId, 0);
            console.log('Cleared notifications for user:', userId);
        } catch (error) {
            console.error('Error clearing user notifications:', error);
        }
    }

    // Get all students in a course
    private async getStudentsInCourse(courseId: string, excludeUserId?: string): Promise<StudentUser[]> {
        try {
            const studentsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('courseIds', 'array-contains', courseId)
            );

            const studentsSnapshot = await getDocs(studentsQuery);
            const students = studentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as StudentUser))
                .filter(student => excludeUserId ? student.id !== excludeUserId : true);

            console.log(`Found ${students.length} students in course ${courseId}`);
            return students;
        } catch (error) {
            console.error('Error getting students in course:', error);
            return [];
        }
    }

    // Log notification for tracking/analytics
    private async logNotification(trigger: NotificationTrigger) {
        try {
            const notificationLog = {
                ...trigger,
                timestamp: serverTimestamp(),
                processed: true
            };

            await updateDoc(doc(db, 'courses', trigger.courseId), {
                [`notificationLogs.${Date.now()}`]: notificationLog
            });
        } catch (error) {
            console.error('Error logging notification:', error);
        }
    }

    // Initialize notification counting for a course (call when course is created)
    async initializeCourseNotifications(courseId: string) {
        try {
            await updateDoc(doc(db, 'courses', courseId), {
                notificationSettings: {
                    announcementNotifications: true,
                    discussionMilestoneNotifications: true,
                    replyNotifications: true,
                    lastDiscussionMilestone: 0
                },
                notificationLogs: {}
            });
        } catch (error) {
            console.error('Error initializing course notifications:', error);
        }
    }
}

export const notificationHelpers = new NotificationHelpers(); 