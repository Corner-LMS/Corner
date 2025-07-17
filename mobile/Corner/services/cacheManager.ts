import { offlineCacheService } from './offlineCache';
import { Alert } from 'react-native';

export class CacheManager {

    // Clear all cached data
    static async clearAllCache(): Promise<void> {
        try {
            await offlineCacheService.clearAllCache();
        } catch (error) {
            console.error('Error clearing cache:', error);
            throw error;
        }
    }

    // Clear cache for a specific course
    static async clearCourseCache(courseId: string): Promise<void> {
        try {
            await offlineCacheService.removeCourseCache(courseId);
        } catch (error) {
            console.error('Error clearing course cache:', error);
            throw error;
        }
    }

    // Get cache statistics
    static async getCacheStats(): Promise<{
        announcements: number;
        resources: number;
        totalItems: number;
        lastSyncTime?: number;
    }> {
        try {
            const { announcements, resources } = await offlineCacheService.getCacheSize();

            return {
                announcements,
                resources,
                totalItems: announcements + resources,
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return {
                announcements: 0,
                resources: 0,
                totalItems: 0,
            };
        }
    }

    // Check if cache is stale
    static async isCacheStale(): Promise<boolean> {
        try {
            return await offlineCacheService.isCacheStale();
        } catch (error) {
            console.error('Error checking cache staleness:', error);
            return true;
        }
    }

    // Show confirmation dialog before clearing cache
    static showClearCacheConfirmation(onConfirm: () => void): void {
        Alert.alert(
            "Clear Cache",
            "This will remove all offline data. You'll need to go online to download fresh content. Continue?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Clear Cache",
                    style: "destructive",
                    onPress: onConfirm
                }
            ]
        );
    }

    // Sync all cached data
    static async syncAllCachedData(courseIds: string[], courseNames: string[]): Promise<void> {
        try {
            const syncPromises = courseIds.map(async (courseId, index) => {
                const courseName = courseNames[index];
                await Promise.all([
                    offlineCacheService.syncAnnouncementsFromFirebase(courseId, courseName),
                    offlineCacheService.syncResourcesFromFirebase(courseId, courseName)
                ]);
            });

            await Promise.all(syncPromises);
            await offlineCacheService.updateLastSyncTime();

        } catch (error) {
            console.error('Error syncing cached data:', error);
            throw error;
        }
    }

    // Initialize cache with maintenance
    static async initializeWithMaintenance(): Promise<void> {
        try {
            await offlineCacheService.initializeCache();

            // Check if cache is stale and needs refreshing
            const isStale = await this.isCacheStale();
            if (isStale) {
                // console.log('Cache is stale - will refresh on next online sync');
            }
        } catch (error) {
            console.error('Error initializing cache with maintenance:', error);
        }
    }

    // Get cache status for display
    static async getCacheStatusDisplay(): Promise<string> {
        try {
            const stats = await this.getCacheStats();
            const isStale = await this.isCacheStale();

            if (stats.totalItems === 0) {
                return "No cached content";
            }

            const statusText = `${stats.totalItems} items cached`;
            return isStale ? `${statusText} (needs refresh)` : statusText;
        } catch (error) {
            return "Cache status unknown";
        }
    }
}

export const cacheManager = CacheManager; 