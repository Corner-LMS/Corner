import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/ firebase-config';
import { collection, query, orderBy, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';

export interface CachedAnnouncement {
    id: string;
    title: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
    authorId: string;
    courseId: string;
    courseName: string;
    lastUpdated: number;
}

export interface CachedResource {
    id: string;
    title: string;
    type: 'link' | 'text';
    content: string;
    description?: string;
    createdAt: any;
    createdBy: string;
    courseId: string;
    courseName: string;
    lastUpdated: number;
}

export interface CachedDiscussion {
    id: string;
    title: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
    authorId: string;
    courseId: string;
    courseName: string;
    replies: number;
    isAnonymous?: boolean;
    lastUpdated: number;
}

export interface CachedComment {
    id: string;
    content: string;
    createdAt: any;
    authorName: string;
    authorRole: string;
    authorId: string;
    discussionId: string;
    courseId: string;
    depth: number;
    parentId?: string;
    isAnonymous?: boolean;
    lastUpdated: number;
}

export interface CacheMetadata {
    lastSyncTime: number;
    version: string;
}

class OfflineCacheService {
    private readonly ANNOUNCEMENTS_KEY = 'cached_announcements';
    private readonly RESOURCES_KEY = 'cached_resources';
    private readonly DISCUSSIONS_KEY = 'cached_discussions';
    private readonly COMMENTS_KEY = 'cached_comments';
    private readonly METADATA_KEY = 'cache_metadata';
    private readonly CACHE_VERSION = '1.1.0'; // Updated version for discussions support
    private readonly CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

    // Initialize cache
    async initializeCache(): Promise<void> {
        try {
            const metadata = await this.getCacheMetadata();
            if (!metadata || metadata.version !== this.CACHE_VERSION) {
                await this.clearAllCache();
                await this.setCacheMetadata({
                    lastSyncTime: Date.now(),
                    version: this.CACHE_VERSION
                });
            }
        } catch (error) {
            console.error('Error initializing cache:', error);
        }
    }

    // Cache Metadata Management
    private async getCacheMetadata(): Promise<CacheMetadata | null> {
        try {
            const metadata = await AsyncStorage.getItem(this.METADATA_KEY);
            return metadata ? JSON.parse(metadata) : null;
        } catch (error) {
            console.error('Error getting cache metadata:', error);
            return null;
        }
    }

    private async setCacheMetadata(metadata: CacheMetadata): Promise<void> {
        try {
            await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
        } catch (error) {
            console.error('Error setting cache metadata:', error);
        }
    }

    // Announcements Caching
    async cacheAnnouncements(courseId: string, announcements: any[], courseName: string): Promise<void> {
        try {
            const cachedAnnouncements: CachedAnnouncement[] = announcements.map(announcement => ({
                ...announcement,
                courseId,
                courseName,
                lastUpdated: Date.now()
            }));

            const existingCache = await this.getCachedAnnouncements();
            const updatedCache = [
                ...existingCache.filter(item => item.courseId !== courseId),
                ...cachedAnnouncements
            ];

            await AsyncStorage.setItem(this.ANNOUNCEMENTS_KEY, JSON.stringify(updatedCache));
            // Cached announcements successfully
        } catch (error) {
            console.error('Error caching announcements:', error);
        }
    }

    async getCachedAnnouncements(courseId?: string): Promise<CachedAnnouncement[]> {
        try {
            const cached = await AsyncStorage.getItem(this.ANNOUNCEMENTS_KEY);
            if (!cached) return [];

            const announcements: CachedAnnouncement[] = JSON.parse(cached);

            if (courseId) {
                return announcements.filter(item => item.courseId === courseId);
            }

            return announcements;
        } catch (error) {
            console.error('Error getting cached announcements:', error);
            return [];
        }
    }

    // Course Resources Caching
    async cacheResources(courseId: string, resources: any[], courseName: string): Promise<void> {
        try {
            const cachedResources: CachedResource[] = resources.map(resource => ({
                ...resource,
                courseId,
                courseName,
                lastUpdated: Date.now()
            }));

            const existingCache = await this.getCachedResources();
            const updatedCache = [
                ...existingCache.filter(item => item.courseId !== courseId),
                ...cachedResources
            ];

            await AsyncStorage.setItem(this.RESOURCES_KEY, JSON.stringify(updatedCache));
            // Cached resources successfully
        } catch (error) {
            console.error('Error caching resources:', error);
        }
    }

    async getCachedResources(courseId?: string): Promise<CachedResource[]> {
        try {
            const cached = await AsyncStorage.getItem(this.RESOURCES_KEY);
            if (!cached) return [];

            const resources: CachedResource[] = JSON.parse(cached);

            if (courseId) {
                return resources.filter(item => item.courseId === courseId);
            }

            return resources;
        } catch (error) {
            console.error('Error getting cached resources:', error);
            return [];
        }
    }

    // Discussions Caching
    async cacheDiscussions(courseId: string, discussions: any[], courseName: string): Promise<void> {
        try {
            const cachedDiscussions: CachedDiscussion[] = discussions.map(discussion => ({
                ...discussion,
                courseId,
                courseName,
                lastUpdated: Date.now()
            }));

            const existingCache = await this.getCachedDiscussions();
            const updatedCache = [
                ...existingCache.filter(item => item.courseId !== courseId),
                ...cachedDiscussions
            ];

            await AsyncStorage.setItem(this.DISCUSSIONS_KEY, JSON.stringify(updatedCache));
            // Cached discussions successfully
        } catch (error) {
            console.error('Error caching discussions:', error);
        }
    }

    async getCachedDiscussions(courseId?: string): Promise<CachedDiscussion[]> {
        try {
            const cached = await AsyncStorage.getItem(this.DISCUSSIONS_KEY);
            if (!cached) return [];

            const discussions: CachedDiscussion[] = JSON.parse(cached);

            if (courseId) {
                return discussions.filter(item => item.courseId === courseId);
            }

            return discussions;
        } catch (error) {
            console.error('Error getting cached discussions:', error);
            return [];
        }
    }

    // Comments Caching
    async cacheComments(discussionId: string, courseId: string, comments: any[]): Promise<void> {
        try {
            const cachedComments: CachedComment[] = comments.map(comment => ({
                ...comment,
                discussionId,
                courseId,
                lastUpdated: Date.now()
            }));

            const existingCache = await this.getCachedComments();
            const updatedCache = [
                ...existingCache.filter(item => item.discussionId !== discussionId),
                ...cachedComments
            ];

            await AsyncStorage.setItem(this.COMMENTS_KEY, JSON.stringify(updatedCache));
            // Cached comments successfully
        } catch (error) {
            console.error('Error caching comments:', error);
        }
    }

    async getCachedComments(discussionId?: string, courseId?: string): Promise<CachedComment[]> {
        try {
            const cached = await AsyncStorage.getItem(this.COMMENTS_KEY);
            if (!cached) return [];

            const comments: CachedComment[] = JSON.parse(cached);

            if (discussionId) {
                return comments.filter(item => item.discussionId === discussionId);
            }

            if (courseId) {
                return comments.filter(item => item.courseId === courseId);
            }

            return comments;
        } catch (error) {
            console.error('Error getting cached comments:', error);
            return [];
        }
    }

    // Sync Methods
    async syncAnnouncementsFromFirebase(courseId: string, courseName: string): Promise<any[]> {
        try {
            const announcementsQuery = query(
                collection(db, 'courses', courseId, 'announcements'),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(announcementsQuery);
            const announcements = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache the fetched data
            await this.cacheAnnouncements(courseId, announcements, courseName);

            return announcements;
        } catch (error) {
            console.error('Error syncing announcements from Firebase:', error);
            throw error;
        }
    }

    async syncResourcesFromFirebase(courseId: string, courseName: string): Promise<any[]> {
        try {
            const resourcesQuery = query(
                collection(db, 'courses', courseId, 'resources'),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(resourcesQuery);
            const resources = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache the fetched data
            await this.cacheResources(courseId, resources, courseName);

            return resources;
        } catch (error) {
            console.error('Error syncing resources from Firebase:', error);
            throw error;
        }
    }

    async syncDiscussionsFromFirebase(courseId: string, courseName: string): Promise<any[]> {
        try {
            const discussionsQuery = query(
                collection(db, 'courses', courseId, 'discussions'),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(discussionsQuery);
            const discussions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache the fetched data
            await this.cacheDiscussions(courseId, discussions, courseName);

            return discussions;
        } catch (error) {
            console.error('Error syncing discussions from Firebase:', error);
            throw error;
        }
    }

    async syncCommentsFromFirebase(discussionId: string, courseId: string): Promise<any[]> {
        try {
            const commentsQuery = query(
                collection(db, 'courses', courseId, 'discussions', discussionId, 'comments'),
                orderBy('createdAt', 'asc')
            );

            const snapshot = await getDocs(commentsQuery);
            const comments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache the fetched data
            await this.cacheComments(discussionId, courseId, comments);

            return comments;
        } catch (error) {
            console.error('Error syncing comments from Firebase:', error);
            throw error;
        }
    }

    // Cache Management
    async isCacheStale(): Promise<boolean> {
        try {
            const metadata = await this.getCacheMetadata();
            if (!metadata) return true;

            const hoursSinceLastSync = (Date.now() - metadata.lastSyncTime) / (1000 * 60 * 60);
            return hoursSinceLastSync > this.CACHE_EXPIRY_HOURS;
        } catch (error) {
            console.error('Error checking cache staleness:', error);
            return true;
        }
    }

    async updateLastSyncTime(): Promise<void> {
        try {
            const metadata = await this.getCacheMetadata();
            if (metadata) {
                await this.setCacheMetadata({
                    ...metadata,
                    lastSyncTime: Date.now()
                });
            }
        } catch (error) {
            console.error('Error updating last sync time:', error);
        }
    }

    async clearAllCache(): Promise<void> {
        try {
            await AsyncStorage.multiRemove([
                this.ANNOUNCEMENTS_KEY,
                this.RESOURCES_KEY,
                this.DISCUSSIONS_KEY,
                this.COMMENTS_KEY,
                this.METADATA_KEY
            ]);
            console.log('All cache cleared');
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    async getCacheSize(): Promise<{
        announcements: number;
        resources: number;
        discussions: number;
        comments: number;
    }> {
        try {
            const [announcements, resources, discussions, comments] = await Promise.all([
                this.getCachedAnnouncements(),
                this.getCachedResources(),
                this.getCachedDiscussions(),
                this.getCachedComments()
            ]);

            return {
                announcements: announcements.length,
                resources: resources.length,
                discussions: discussions.length,
                comments: comments.length
            };
        } catch (error) {
            console.error('Error getting cache size:', error);
            return { announcements: 0, resources: 0, discussions: 0, comments: 0 };
        }
    }

    // Remove cached data for a specific course
    async removeCourseCache(courseId: string): Promise<void> {
        try {
            const [announcements, resources, discussions, comments] = await Promise.all([
                this.getCachedAnnouncements(),
                this.getCachedResources(),
                this.getCachedDiscussions(),
                this.getCachedComments()
            ]);

            const filteredAnnouncements = announcements.filter(item => item.courseId !== courseId);
            const filteredResources = resources.filter(item => item.courseId !== courseId);
            const filteredDiscussions = discussions.filter(item => item.courseId !== courseId);
            const filteredComments = comments.filter(item => item.courseId !== courseId);

            await Promise.all([
                AsyncStorage.setItem(this.ANNOUNCEMENTS_KEY, JSON.stringify(filteredAnnouncements)),
                AsyncStorage.setItem(this.RESOURCES_KEY, JSON.stringify(filteredResources)),
                AsyncStorage.setItem(this.DISCUSSIONS_KEY, JSON.stringify(filteredDiscussions)),
                AsyncStorage.setItem(this.COMMENTS_KEY, JSON.stringify(filteredComments))
            ]);

            console.log(`Removed cache for course ${courseId}`);
        } catch (error) {
            console.error('Error removing course cache:', error);
        }
    }
}

export const offlineCacheService = new OfflineCacheService(); 