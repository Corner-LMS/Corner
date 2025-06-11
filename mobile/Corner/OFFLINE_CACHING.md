# Offline Caching Implementation

This document describes the offline caching functionality implemented for announcements and course resources in the Corner mobile app.

## Overview

The offline caching system allows users to:
- View announcements and course resources when offline
- Automatically cache content when online
- Sync data when reconnecting to the internet
- Maintain data consistency across online/offline states

## Components

### 1. OfflineCacheService (`services/offlineCache.ts`)
Main service that handles all caching operations:
- **Caching**: Stores announcements and resources locally using AsyncStorage
- **Retrieval**: Fetches cached data when offline
- **Syncing**: Updates cache from Firebase when online
- **Management**: Handles cache expiry, cleanup, and versioning

### 2. Network Status Hook (`hooks/useNetworkStatus.ts`)
React hook that monitors network connectivity:
- Detects online/offline status
- Identifies reconnection events
- Provides real-time network state updates

### 3. Cache Manager (`services/cacheManager.ts`)
Utility class for cache maintenance:
- Clear cache operations
- Cache statistics
- Sync management
- User-facing cache operations

### 4. UI Components
- **OfflineStatusBar**: Shows connectivity status
- **Modified screens**: Course detail and resources screens with offline indicators

## Usage

### Automatic Caching
When users are online:
1. Data is fetched from Firebase as usual
2. Retrieved data is automatically cached locally
3. Cache is updated with latest timestamps

### Offline Mode
When users go offline:
1. Screens detect offline status using `useNetworkStatus`
2. Cached data is loaded from AsyncStorage
3. UI shows offline indicators and cached content badges
4. Edit/delete operations are disabled

### Reconnection Sync
When users reconnect:
1. `hasReconnected` flag is triggered
2. Fresh data is fetched from Firebase
3. Cache is updated with new data
4. UI shows sync success indicator

## Cache Structure

### Announcements
```typescript
interface CachedAnnouncement {
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
```

### Resources
```typescript
interface CachedResource {
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
```

## Configuration

### Cache Settings
- **Expiry**: 24 hours (configurable)
- **Storage**: AsyncStorage with JSON serialization
- **Versioning**: Automatic cache clearing on version updates

### Keys Used
- `cached_announcements`: Announcements storage
- `cached_resources`: Resources storage  
- `cache_metadata`: Cache version and sync info

## Integration Points

### Course Detail Screen (`app/course-detail.tsx`)
- Uses network status hook
- Loads cached announcements when offline
- Shows offline indicators
- Syncs on reconnection

### Course Resources Screen (`app/course-resources.tsx`)
- Caches both text content and links
- Disables add functionality when offline
- Shows cached content indicators
- Handles both teacher and student views

### App Layout (`app/_layout.tsx`)
- Initializes cache on app startup
- Ensures cache is ready before screens load

## Error Handling

- **Network errors**: Gracefully fall back to cached data
- **Cache errors**: Log errors but don't break functionality  
- **Sync failures**: Retry on next connection
- **Storage errors**: Clear corrupted cache and reinitialize

## Performance Considerations

- **Lazy loading**: Cache is loaded only when needed
- **Efficient storage**: JSON serialization for optimal storage
- **Memory usage**: Data is not kept in memory unnecessarily
- **Background sync**: Sync operations don't block UI

## Future Enhancements

Potential improvements:
1. **Selective sync**: Only sync changed items
2. **Compression**: Compress cached data to save space
3. **Background sync**: Sync in background when app is backgrounded
4. **Cache size limits**: Implement maximum cache size with LRU eviction
5. **Offline editing**: Allow editing with sync on reconnection

## Debugging

Enable debugging by checking console logs:
- Cache operations are logged with prefixes
- Network status changes are logged
- Sync operations show progress and results
- Errors include stack traces for debugging

## Dependencies

- `@react-native-async-storage/async-storage`: Local storage
- `@react-native-community/netinfo`: Network status detection
- `firebase/firestore`: Data synchronization 