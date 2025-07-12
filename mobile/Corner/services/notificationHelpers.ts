import firestore from '@react-native-firebase/firestore';
import { increment, serverTimestamp } from '@react-native-firebase/firestore';
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
            const userRef = firestore().collection('users').doc(userId);
            await userRef.update({
                'notificationData.unreadCount': reset ? 0 :
                    increment(incrementBy > 0 ? incrementBy : 0),
                'notificationData.lastNotificationTime': new Date()
            });
        } catch (error) {
            console.error('❌ [NOTIFICATIONS] Error updating user badge count:', error);
        }
    }

    private async shouldCreateNotification(userId: string, notificationType: string): Promise<boolean> {
        try {
            const userDoc = await firestore().collection('users').doc(userId).get();
            const userData = userDoc.data();

            if (!userData?.notificationSettings) {
                return true; // Default to true if settings don't exist
            }

            const settings = userData.notificationSettings;
            let shouldCreate = false;

            switch (notificationType) {
                case 'announcement':
                    shouldCreate = settings.announcementNotifications;
                    break;
                case 'discussion_milestone':
                    shouldCreate = settings.discussionMilestoneNotifications;
                    break;
                case 'discussion_replies':
                    shouldCreate = settings.replyNotifications;
                    break;
                case 'teacher_discussion_milestone':
                    shouldCreate = settings.teacherDiscussionMilestoneNotifications;
                    break;
                default:
                    shouldCreate = true;
            }

            return shouldCreate;
        } catch (error) {
            console.error('❌ [NOTIFICATIONS] Error checking notification settings:', error);
            return true; // Default to true if there's an error
        }
    }

    // Notify students of new announcement
    async notifyStudentsOfAnnouncement(courseId: string, announcementData: any, teacherId: string) {
        try {
            // Get course details
            const courseRef = firestore().collection('courses').doc(courseId);
            const courseDoc = await courseRef.get();
            const courseName = courseDoc.data()?.name || 'Course';

            // Get all students in the course
            const studentsQuery = firestore().collection('users').where('role', '==', 'student').where('courseIds', 'array-contains', courseId);
            const studentsSnapshot = await studentsQuery.get();
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
                    return;
                }

                // Save notification to Firestore
                await firestore().collection('notifications').add({
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

            // Send push notifications to all students
            try {
                // Calculate total badge count for all students
                const totalBadgeCount = students.length;
                await notificationService.sendPushNotificationToCourse(courseId, notificationData, totalBadgeCount);
            } catch (error) {
                console.error('❌ [PUSH] Error sending push notifications for announcement:', error);
            }

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
            console.error('❌ [NOTIFICATIONS] Error sending announcement notifications:', error);
        }
    }

    // Notify students of discussion milestone
    private async notifyStudentsOfDiscussionMilestone(courseId: string, newPostAuthorId: string, totalDiscussions: number, courseName: string) {
        try {
            // Get all students in the course
            const studentsQuery = firestore().collection('users')
                .where('role', '==', 'student')
                .where('courseIds', 'array-contains', courseId);

            const studentsSnapshot = await studentsQuery.get();
            const students = studentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as StudentUser[];

            // Create notification data
            const notificationData: NotificationData = {
                type: 'discussion_milestone',
                courseId: courseId,
                courseName: courseName,
                title: 'Discussion Milestone Reached!',
                body: `Your course "${courseName}" has reached ${totalDiscussions} discussions! Keep the conversation going.`,
                data: {
                    milestone: totalDiscussions,
                    courseId: courseId,
                    courseName: courseName
                }
            };

            // Create in-app notifications for each student
            const notificationPromises = students.map(async (student: StudentUser) => {
                // Check if notification should be created based on user settings
                const shouldCreate = await this.shouldCreateNotification(student.id, 'discussion_milestone');
                if (!shouldCreate) {
                    return;
                }

                // Save notification to Firestore
                await firestore().collection('notifications').add({
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

            // Send push notifications to all students
            try {
                // Calculate total badge count for all students
                const totalBadgeCount = students.length;
                await notificationService.sendPushNotificationToCourse(courseId, notificationData, totalBadgeCount);
            } catch (error) {
                console.error('❌ [PUSH] Error sending push notifications for discussion milestone:', error);
            }

            // Track notification in Firestore
            await this.logNotification({
                type: 'discussion_milestone',
                courseId: courseId,
                triggeredBy: newPostAuthorId,
                metadata: {
                    discussionTitle: notificationData.title,
                    milestoneType: 'discussion_milestone',
                    studentCount: students.length
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
            const teacherRef = firestore().collection('users').doc(teacherId);
            const teacherDoc = await teacherRef.get();
            const teacherData = teacherDoc.data();

            if (!teacherData) {
                console.error('Teacher not found:', teacherId);
                return;
            }

            // Check if notification should be created based on user settings
            const shouldCreate = await this.shouldCreateNotification(teacherId, 'teacher_discussion_milestone');
            if (!shouldCreate) {
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
            await firestore().collection('notifications').add({
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
            const discussionRef = firestore().collection('courses').doc(courseId).collection('discussions').doc(discussionId);
            const discussionDoc = await discussionRef.get();
            const discussionData = discussionDoc.data();

            if (!discussionData) {
                console.warn(`Discussion not found: ${discussionId} in course: ${courseId}`);
                return; // Silently return without showing error
            }

            const originalAuthorId = discussionData.authorId;
            const courseName = discussionData.courseName || 'Course';

            // Count replies
            const repliesQuery = firestore().collection('courses').doc(courseId).collection('discussions').doc(discussionId).collection('comments').orderBy('createdAt', 'asc');
            const repliesSnapshot = await repliesQuery.get();
            const replies = repliesSnapshot.size;

            // Notify when exactly 5 replies
            if (replies === 5) {
                // Check if notification should be created based on user settings
                const shouldCreate = await this.shouldCreateNotification(originalAuthorId, 'discussion_replies');
                if (!shouldCreate) {
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
                const authorRef = firestore().collection('users').doc(originalAuthorId);
                const authorDoc = await authorRef.get();
                const authorData = authorDoc.data();

                if (authorData) {
                    // Save notification to Firestore
                    await firestore().collection('notifications').add({
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
            console.error('❌ [NOTIFICATIONS] Error clearing user notifications:', error);
            throw error;
        }
    }

    // Get all students in a course
    private async getStudentsInCourse(courseId: string, excludeUserId?: string): Promise<StudentUser[]> {
        try {
            const studentsQuery = firestore().collection('users').where('role', '==', 'student').where('courseIds', 'array-contains', courseId);
            const studentsSnapshot = await studentsQuery.get();
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
            await firestore().collection('notificationLogs').add({
                ...data,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error('❌ [NOTIFICATIONS] Error logging notification:', error);
        }
    }

    // Initialize notification counting for a course (call when course is created)
    async initializeCourseNotifications(courseId: string) {
        try {
            await firestore().collection('courses').doc(courseId).update({
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

    // Check and notify for discussion milestones
    async checkDiscussionMilestone(courseId: string, newPostAuthorId: string) {
        try {
            // Get course details
            const courseRef = firestore().collection('courses').doc(courseId);
            const courseDoc = await courseRef.get();
            const courseData = courseDoc.data();

            if (!courseData) {
                return;
            }

            const courseName = courseData.name || 'Course';

            // Get total discussions count
            const discussionsQuery = firestore().collection('discussions').where('courseId', '==', courseId);
            const discussionsSnapshot = await discussionsQuery.get();
            const totalDiscussions = discussionsSnapshot.size;

            // Check for milestone (every 10 discussions)
            const milestone = Math.floor(totalDiscussions / 10) * 10;
            const lastMilestone = courseData.notificationSettings?.lastDiscussionMilestone || 0;

            if (milestone > lastMilestone && milestone > 0) {
                // Notify students
                await this.notifyStudentsOfDiscussionMilestone(courseId, newPostAuthorId, totalDiscussions, courseName);

                // Notify teacher if they have the setting enabled
                if (courseData.teacherId) {
                    await this.notifyTeacherOfDiscussionMilestone(courseId, courseData.teacherId, totalDiscussions, courseName);
                }

                // Update course milestone
                await courseRef.update({
                    'notificationSettings.lastDiscussionMilestone': milestone
                });
            }

        } catch (error) {
            console.error('❌ [NOTIFICATIONS] Error checking discussion milestone:', error);
        }
    }
}

export const notificationHelpers = new NotificationHelpers(); 