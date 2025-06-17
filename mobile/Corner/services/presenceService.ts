import { auth, db } from '../config/ firebase-config';
import { doc, updateDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export interface TeacherPresence {
    userId: string;
    isOnline: boolean;
    lastSeen: any;
    name: string;
}

export interface PresenceNotification {
    teacherId: string;
    teacherName: string;
    courseId: string;
    courseName: string;
    timestamp: number;
}

class PresenceService {
    private presenceListeners: Map<string, () => void> = new Map();
    private isInitialized = false;
    private currentRole: string | null = null;
    private appStateSubscription: any = null;
    private netInfoUnsubscribe: any = null;
    private notificationCallbacks: ((notification: PresenceNotification) => void)[] = [];
    private notifiedTeachers: Set<string> = new Set(); // Track teachers we've already notified about this session

    // Initialize presence system
    async initialize(userRole: string): Promise<void> {
        if (this.isInitialized) return;

        this.currentRole = userRole;

        // Reset notification tracking for new session
        this.resetNotificationTracking();

        if (userRole === 'teacher') {
            await this.initializeTeacherPresence();
        } else if (userRole === 'student') {
            await this.initializeStudentListeners();
        }

        this.setupAppStateListener();
        this.setupNetworkListener();
        this.isInitialized = true;

        console.log(`Presence service initialized for ${userRole}`);
    }

    // Initialize teacher presence tracking
    private async initializeTeacherPresence(): Promise<void> {
        const user = auth.currentUser;
        if (!user) return;

        try {
            // Set teacher as online
            await this.setTeacherOnlineStatus(true);

            // Listen for app state changes
            this.setupPresenceCleanup();
        } catch (error) {
            console.error('Error initializing teacher presence:', error);
        }
    }

    // Initialize student listeners for teacher presence
    private async initializeStudentListeners(): Promise<void> {
        const user = auth.currentUser;
        if (!user) return;

        try {
            // Get student's enrolled courses
            const coursesQuery = query(
                collection(db, 'courses'),
                where('students', 'array-contains', user.uid)
            );

            const coursesSnapshot = await getDocs(coursesQuery);

            // Listen for each teacher's online status
            for (const courseDoc of coursesSnapshot.docs) {
                const courseData = courseDoc.data();
                const teacherId = courseData.createdBy;

                if (teacherId && !this.presenceListeners.has(teacherId)) {
                    this.listenToTeacherPresence(
                        teacherId,
                        courseDoc.id,
                        courseData.name || 'Course'
                    );
                }
            }
        } catch (error) {
            console.error('Error initializing student listeners:', error);
        }
    }

    // Set teacher online status
    async setTeacherOnlineStatus(isOnline: boolean): Promise<void> {
        const user = auth.currentUser;
        if (!user || this.currentRole !== 'teacher') return;

        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                isOnline: isOnline,
                lastSeen: serverTimestamp()
            });

            console.log(`Teacher status updated: ${isOnline ? 'online' : 'offline'}`);
        } catch (error) {
            console.error('Error updating teacher presence:', error);
        }
    }

    // Listen to a specific teacher's presence
    private listenToTeacherPresence(teacherId: string, courseId: string, courseName: string): void {
        const teacherDocRef = doc(db, 'users', teacherId);
        let previousOnlineStatus = false; // Track previous online status

        const unsubscribe = onSnapshot(teacherDocRef, (doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                const currentOnlineStatus = userData.isOnline === true;

                // Only notify if teacher just came online (was offline before)
                if (!previousOnlineStatus && currentOnlineStatus && !this.notifiedTeachers.has(teacherId)) {
                    this.notifiedTeachers.add(teacherId);

                    const notification: PresenceNotification = {
                        teacherId,
                        teacherName: userData.name || 'Your instructor',
                        courseId,
                        courseName,
                        timestamp: Date.now()
                    };

                    // Notify all registered callbacks
                    this.notificationCallbacks.forEach(callback => {
                        try {
                            callback(notification);
                        } catch (error) {
                            console.error('Error in presence notification callback:', error);
                        }
                    });
                }

                // Update previous status for next comparison
                previousOnlineStatus = currentOnlineStatus;
            }
        }, (error) => {
            console.error(`Error listening to teacher ${teacherId} presence:`, error);
        });

        this.presenceListeners.set(teacherId, unsubscribe);
    }

    // Register callback for teacher online notifications
    onTeacherOnline(callback: (notification: PresenceNotification) => void): () => void {
        this.notificationCallbacks.push(callback);

        // Return unsubscribe function
        return () => {
            const index = this.notificationCallbacks.indexOf(callback);
            if (index > -1) {
                this.notificationCallbacks.splice(index, 1);
            }
        };
    }

    // Setup app state listener for presence cleanup
    private setupAppStateListener(): void {
        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    }

    // Setup network listener
    private setupNetworkListener(): void {
        this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
            const isOnline = state.isConnected === true && state.isInternetReachable === true;

            if (this.currentRole === 'teacher') {
                // Update teacher presence based on network status
                this.setTeacherOnlineStatus(isOnline);
            }
        });
    }

    // Handle app state changes
    private handleAppStateChange = (nextAppState: AppStateStatus): void => {
        if (this.currentRole === 'teacher') {
            if (nextAppState === 'active') {
                // App became active - set teacher online
                this.setTeacherOnlineStatus(true);
            } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                // App went to background - set teacher offline after delay
                setTimeout(() => {
                    this.setTeacherOnlineStatus(false);
                }, 30000); // 30 second delay before marking offline
            }
        }
    };

    // Setup presence cleanup for teachers
    private setupPresenceCleanup(): void {
        if (this.currentRole !== 'teacher') return;

        // Set offline when app is about to close
        const cleanup = () => {
            this.setTeacherOnlineStatus(false);
        };

        // Handle various app lifecycle events
        const events = ['beforeunload', 'unload', 'pagehide'];
        events.forEach(event => {
            window?.addEventListener?.(event, cleanup);
        });
    }

    // Add a teacher to watch list (for dynamic course enrollment)
    async addTeacherToWatch(teacherId: string, courseId: string, courseName: string): Promise<void> {
        if (this.currentRole !== 'student') return;

        if (!this.presenceListeners.has(teacherId)) {
            this.listenToTeacherPresence(teacherId, courseId, courseName);
        }
    }

    // Remove teacher from watch list
    removeTeacherFromWatch(teacherId: string): void {
        const unsubscribe = this.presenceListeners.get(teacherId);
        if (unsubscribe) {
            unsubscribe();
            this.presenceListeners.delete(teacherId);
        }
    }

    // Reset notification tracking for new session
    private resetNotificationTracking(): void {
        this.notifiedTeachers.clear();
        console.log('Reset notification tracking for new session');
    }

    // Cleanup all listeners
    cleanup(): void {
        // Set teacher offline before cleanup
        if (this.currentRole === 'teacher') {
            this.setTeacherOnlineStatus(false);
        }

        // Remove all presence listeners
        this.presenceListeners.forEach(unsubscribe => unsubscribe());
        this.presenceListeners.clear();

        // Remove app state listener
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        // Remove network listener
        if (this.netInfoUnsubscribe) {
            this.netInfoUnsubscribe();
            this.netInfoUnsubscribe = null;
        }

        // Clear notification callbacks
        this.notificationCallbacks = [];
        this.notifiedTeachers.clear();

        this.isInitialized = false;
        this.currentRole = null;

        console.log('Presence service cleaned up');
    }

    // Get current presence state
    getPresenceState(): {
        isInitialized: boolean;
        role: string | null;
        watchedTeachers: number;
    } {
        return {
            isInitialized: this.isInitialized,
            role: this.currentRole,
            watchedTeachers: this.presenceListeners.size
        };
    }
}

export const presenceService = new PresenceService(); 