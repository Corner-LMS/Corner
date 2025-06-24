// Performance optimization utilities for the Corner app

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

class CacheManager {
    private cache = new Map<string, CacheEntry<any>>();
    private defaultTTL = 5 * 60 * 1000; // 5 minutes

    set<T>(key: string, data: T, ttl?: number): void {
        const now = Date.now();
        const expiresAt = now + (ttl || this.defaultTTL);

        this.cache.set(key, {
            data,
            timestamp: now,
            expiresAt
        });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    has(key: string): boolean {
        return this.get(key) !== null;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    // Clean up expired entries
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
}

// Global cache instance
export const cacheManager = new CacheManager();

// Cache keys
export const CACHE_KEYS = {
    DASHBOARD: 'dashboard',
    ANALYTICS: 'analytics',
    USER_DATA: 'user_data',
    COURSES: 'courses',
    TEACHER_NAMES: 'teacher_names',
} as const;

// Debounce utility for expensive operations
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Throttle utility for rate limiting
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Batch operations utility
export async function batchOperation<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    batchSize: number = 10
): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(operation));
        results.push(...batchResults);
    }

    return results;
}

// Memory usage optimization
export function optimizeMemoryUsage(): void {
    // Clean up expired cache entries
    cacheManager.cleanup();

    // Force garbage collection if available (React Native doesn't expose this)
    if (global.gc) {
        global.gc();
    }
}

// Performance monitoring
export class PerformanceMonitor {
    private metrics: Map<string, number[]> = new Map();

    startTimer(key: string): () => void {
        const startTime = Date.now();
        return () => {
            const duration = Date.now() - startTime;
            if (!this.metrics.has(key)) {
                this.metrics.set(key, []);
            }
            this.metrics.get(key)!.push(duration);
        };
    }

    getAverageTime(key: string): number {
        const times = this.metrics.get(key);
        if (!times || times.length === 0) return 0;
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    getMetrics(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [key] of this.metrics) {
            result[key] = this.getAverageTime(key);
        }
        return result;
    }

    clear(): void {
        this.metrics.clear();
    }
}

export const performanceMonitor = new PerformanceMonitor();

// Auto-cleanup on app background/foreground
export function setupPerformanceMonitoring(): void {
    // Clean up cache when app goes to background
    const handleAppStateChange = (nextAppState: string) => {
        if (nextAppState === 'background') {
            optimizeMemoryUsage();
        }
    };

    // Set up periodic cleanup
    setInterval(optimizeMemoryUsage, 10 * 60 * 1000); // Every 10 minutes
}

// Export cache manager instance
export default cacheManager; 