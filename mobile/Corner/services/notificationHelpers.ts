import { db } from '../config/ firebase-config';
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
    addDoc,
    orderBy
} from 'firebase/firestore';
import { notificationService, NotificationData } from './notificationService';

export interface NotificationTrigger {
    type: 'announcement' | 'discussion_milestone' | 'discussion_replies' | 'teacher_discussion_milestone';
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
    private async updateUserBadgeCount(userId: string, incrementBy: number = 1, reset: boolean = false) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                'notificationData.unreadCount': reset ? 0 :
                    increment(incrementBy > 0 ? incrementBy : 0),
                'notificationData.lastNotificationTime': new Date()
            });
        } catch (error) {
            console.error('Error updating user badge count:', error);
        }
    }

    private async shouldCreateNotification(userId: string, notificationType: string): Promise<boolean> {
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

    // Notify students of new announcement
    async notifyStudentsOfAnnouncement(courseId: string, announcementData: any, teacherId: string) {
        try {
            // Get course details
            const courseRef = doc(db, 'courses', courseId);
            const courseDoc = await getDoc(courseRef);
            const courseName = courseDoc.data()?.name || 'Course';

            // Get all students in the course
            const studentsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('courseIds', 'array-contains', courseId)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            const students = studentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as StudentUser[];

            const notificationData: NotificationData = {
                type: 'announcement',
                courseId: courseId,
                courseName: courseName,
                title: `New Announcement in ${courseName}`,
                body: announcementData.title,
                data: {
                    type: 'announcement',
                    courseId: courseId,
                    courseName: courseName,
                    announcementId: announcementData.id
                }
            };

            // Send notifications to all students
            const notificationPromises = students.map(async (student: StudentUser) => {
                // Check if notification should be created based on user settings
                const shouldCreate = await this.shouldCreateNotification(student.id, 'announcement');
                if (!shouldCreate) {
                    console.log('Notification blocked by user settings for student:', student.id);
                    return;
                }

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
            });

            await Promise.all(notificationPromises);

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

    // Notify students of discussion milestone
    private async notifyStudentsOfDiscussionMilestone(courseId: string, newPostAuthorId: string, totalDiscussions: number, courseName: string) {
        try {
            // Get all students in the course
            const studentsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('courseIds', 'array-contains', courseId)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            const students = studentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as StudentUser[];

            const notificationData: NotificationData = {
                type: 'discussion_milestone',
                courseId: courseId,
                courseName: courseName,
                title: `Discussion Milestone in ${courseName}`,
                body: `The class has reached ${totalDiscussions} discussion posts!`,
                data: {
                    type: 'discussion_milestone',
                    courseId: courseId,
                    courseName: courseName,
                    milestone: totalDiscussions
                }
            };

            // Send notifications to all students
            const notificationPromises = students.map(async (student: StudentUser) => {
                // Check if notification should be created based on user settings
                const shouldCreate = await this.shouldCreateNotification(student.id, 'discussion_milestone');
                if (!shouldCreate) {
                    console.log('Notification blocked by user settings for student:', student.id);
                    return;
                }

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
            });

            await Promise.all(notificationPromises);

            // Track notification
            await this.logNotification({
                type: 'discussion_milestone',
                courseId: courseId,
                triggeredBy: newPostAuthorId,
                metadata: {
                    milestone: totalDiscussions,
                    studentCount: students.length,
                    recipientType: 'students'
                }
            });
        } catch (error) {
            console.error('Error notifying students of discussion milestone:', error);
        }
    }

    // Notify teacher of discussion milestone (new method)
    private async notifyTeacherOfDiscussionMilestone(courseId: string, teacherId: string, totalDiscussions: number, courseName: string) {
        try {
            // Get teacher data
            const teacherRef = doc(db, 'users', teacherId);
            const teacherDoc = await getDoc(teacherRef);
            const teacherData = teacherDoc.data();

            if (!teacherData) {
                console.error('Teacher not found:', teacherId);
                return;
            }

            // Check if notification should be created based on user settings
            const shouldCreate = await this.shouldCreateNotification(teacherId, 'teacher_discussion_milestone');
            if (!shouldCreate) {
                console.log('Notification blocked by user settings for teacher:', teacherId);
                return;
            }

            const notificationData: NotificationData = {
                type: 'teacher_discussion_milestone',
                courseId: courseId,
                courseName: courseName,
                title: `Course Activity Milestone`,
                body: `${courseName} has reached ${totalDiscussions} discussion posts!`,
                data: {
                    type: 'teacher_discussion_milestone',
                    courseId: courseId,
                    courseName: courseName,
                    milestone: totalDiscussions
                }
            };

            // Save notification to Firestore
            await addDoc(collection(db, 'notifications'), {
                userId: teacherId,
                type: 'teacher_discussion_milestone',
                title: notificationData.title,
                body: notificationData.body,
                courseId: courseId,
                courseName: courseName,
                timestamp: serverTimestamp(),
                read: false,
                data: notificationData.data
            });

            // Update badge count
            await this.updateUserBadgeCount(teacherId, 1);

            // Track notification
            await this.logNotification({
                type: 'teacher_discussion_milestone',
                courseId: courseId,
                triggeredBy: 'system',
                metadata: {
                    milestone: totalDiscussions,
                    teacherId: teacherId,
                    recipientType: 'teacher'
                }
            });

        } catch (error) {
            console.error('Error notifying teacher of discussion milestone:', error);
        }
    }

    // Check and notify for discussion replies
    async checkDiscussionReplies(courseId: string, discussionId: string, newReplyAuthorId: string) {
        try {
            // Get discussion details - FIXED: Use correct collection path
            const discussionRef = doc(db, 'courses', courseId, 'discussions', discussionId);
            const discussionDoc = await getDoc(discussionRef);
            const discussionData = discussionDoc.data();

            if (!discussionData) {
                console.warn(`Discussion not found: ${discussionId} in course: ${courseId}`);
                return; // Silently return without showing error
            }

            const originalAuthorId = discussionData.authorId;
            const courseName = discussionData.courseName || 'Course';

            // Count replies
            const repliesQuery = query(
                collection(db, 'courses', courseId, 'discussions', discussionId, 'comments'),
                orderBy('createdAt', 'asc')
            );
            const repliesSnapshot = await getDocs(repliesQuery);
            const replies = repliesSnapshot.size;

            // Notify when exactly 5 replies
            if (replies === 5) {
                // Check if notification should be created based on user settings
                const shouldCreate = await this.shouldCreateNotification(originalAuthorId, 'discussion_replies');
                if (!shouldCreate) {
                    console.log('Notification blocked by user settings for user:', originalAuthorId);
                    return;
                }

                const notificationData: NotificationData = {
                    type: 'discussion_replies',
                    courseId: courseId,
                    courseName: courseName,
                    title: 'Your Discussion is Popular!',
                    body: `Your post "${discussionData.title}" has received 5 replies in ${courseName}`,
                    data: {
                        type: 'discussion_replies',
                        courseId: courseId,
                        courseName: courseName,
                        discussionId: discussionId,
                        discussionTitle: discussionData.title
                    }
                };

                // Get author details
                const authorRef = doc(db, 'users', originalAuthorId);
                const authorDoc = await getDoc(authorRef);
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

    // Clear all notifications for a user
    async clearUserNotifications(userId: string) {
        try {
            // Reset the badge count
            await this.updateUserBadgeCount(userId, 0, true); // true = reset completely

            // Note: We don't delete individual notifications from Firestore
            // as they serve as a record. The badge count reset is sufficient.

        } catch (error) {
            console.error('Error clearing user notifications:', error);
            throw error;
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


            return students;
        } catch (error) {
            console.error('Error getting students in course:', error);
            return [];
        }
    }

    // Log notification for analytics
    private async logNotification(data: any) {
        try {
            await addDoc(collection(db, 'notificationLogs'), {
                ...data,
                timestamp: serverTimestamp()
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

    async checkDiscussionMilestone(courseId: string, userId: string) {
        try {
            const courseRef = doc(db, 'courses', courseId);
            const courseDoc = await getDoc(courseRef);
            const courseData = courseDoc.data();
            const courseName = courseData?.name || 'Course';

            // Get total discussions count
            const discussionsQuery = query(
                collection(db, 'courses', courseId, 'discussions'),
                orderBy('createdAt', 'desc')
            );
            const discussionsSnapshot = await getDocs(discussionsQuery);
            const totalDiscussions = discussionsSnapshot.size;

            // Check if we've hit a milestone (every 10 posts)
            if (totalDiscussions % 10 === 0 && totalDiscussions > 0) {
                // Notify students
                await this.notifyStudentsOfDiscussionMilestone(courseId, userId, totalDiscussions, courseName);

                // Notify teacher if they have notifications enabled
                if (courseData?.instructorId) {
                    await this.notifyTeacherOfDiscussionMilestone(courseId, courseData.instructorId, totalDiscussions, courseName);
                }
            }
        } catch (error) {
            console.error('Error checking discussion milestone:', error);
        }
    }
}

export const notificationHelpers = new NotificationHelpers(); 