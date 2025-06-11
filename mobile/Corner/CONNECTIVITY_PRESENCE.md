# Connectivity Indicator & Teacher Presence System

This document describes the implementation of real-time connectivity indicators and teacher online notifications for the Corner mobile app.

## 🎯 **Features Implemented**

### **1. Connectivity Indicator**
- **Real-time Status**: Shows green dot/icon for online, red for offline
- **Multiple Sizes**: Small, medium, large variants for different UI contexts
- **Text Support**: Optional text labels ("Online"/"Offline")
- **Reconnection Feedback**: Special indicator when connection is restored
- **Global Availability**: Used across all major screens

### **2. Teacher Online Notifications**
- **Presence Tracking**: Teachers' online status automatically updated in Firestore
- **Student Notifications**: Students receive banner notifications when their teachers come online
- **Session Management**: Notifications shown only once per session per teacher
- **Auto-dismiss**: Notifications automatically dismiss after 5 seconds
- **Battery Optimized**: Efficient listeners with minimal battery impact

## 🔧 **Technical Implementation**

### **New Components**

#### **ConnectivityIndicator** (`components/ConnectivityIndicator.tsx`)
```typescript
interface ConnectivityIndicatorProps {
    size?: 'small' | 'medium' | 'large';
    showText?: boolean;
    style?: any;
}

Features:
- Uses existing useNetworkStatus hook
- Responsive sizing system
- Icon + dot + text combinations
- Smooth animations for state changes
- Customizable styling
```

#### **TeacherOnlineNotification** (`components/TeacherOnlineNotification.tsx`)
```typescript
Features:
- Slide-in animations from top
- Auto-dismiss with countdown
- Manual dismiss button
- Clean, modern design
- Non-intrusive positioning
```

### **New Services**

#### **PresenceService** (`services/presenceService.ts`)
```typescript
Key Features:
- Teacher presence tracking in Firestore
- Student listener management
- App state monitoring (foreground/background)
- Network state integration
- Session-based notification tracking
- Automatic cleanup on logout

Core Methods:
- initialize(userRole: string)
- setTeacherOnlineStatus(isOnline: boolean)
- onTeacherOnline(callback: function)
- cleanup()
```

### **Integration Points**

#### **App Layout** (`app/_layout.tsx`)
- Initialize presence service on auth state change
- Global teacher notification component for students
- Automatic cleanup on app close/logout

#### **Screen Headers**
Updated the following screens with connectivity indicators:
- **Home Screen** (`app/(tabs)/index.tsx`): Medium size with text
- **Course Detail** (`app/course-detail.tsx`): Small size in header actions
- **Discussion Detail** (`app/discussion-detail.tsx`): Small size in header

## 🎨 **Visual Design**

### **Connectivity Indicator States**
```
🟢 Online: Green dot + wifi icon
🔴 Offline: Red dot + wifi-off icon  
✅ Reconnected: Green checkmark + "Back online"
```

### **Teacher Notification Design**
```
┌─────────────────────────────────────┐
│ 🟢👤 [Teacher Name] is online       │ ✕
│     [Course Name]                   │
├─────────────────────────────────────┤
│ ████████████████████████████████    │ (progress bar)
└─────────────────────────────────────┘
```

## 🔄 **Presence Flow**

### **Teacher Flow**
1. **Login** → Set `isOnline: true` in Firestore
2. **App Active** → Maintain online status
3. **App Background** → 30-second delay, then set offline
4. **Network Lost** → Immediately set offline
5. **Network Restored** → Set online
6. **Logout/Close** → Set offline

### **Student Flow**
1. **Login** → Find enrolled courses & their teachers
2. **Listen** → Subscribe to teacher presence changes
3. **Teacher Online** → Show notification (once per session)
4. **Auto-dismiss** → Hide notification after 5 seconds
5. **Cleanup** → Remove listeners on logout

## 📊 **Performance Optimizations**

### **Battery Efficiency**
- **Minimal Listeners**: Only listen to teachers of enrolled courses
- **Batch Operations**: Efficient Firestore queries
- **Smart Timing**: 30-second delay before marking teachers offline
- **Session Tracking**: Prevent duplicate notifications

### **Network Efficiency**
- **Existing Infrastructure**: Uses existing `useNetworkStatus` hook
- **Conditional Updates**: Only update when status actually changes
- **Error Handling**: Graceful fallbacks for network issues

### **Memory Management**
- **Automatic Cleanup**: Remove listeners on component unmount
- **WeakMap Usage**: For temporary notification tracking
- **Efficient State**: Minimal state variables

## 🛡️ **Error Handling**

### **Network Issues**
- Graceful fallback when offline
- Retry logic for failed status updates
- Clear visual indicators for connection problems

### **Firestore Errors**
- Continue functioning if presence updates fail
- Log errors without disrupting app flow
- Fallback to basic connectivity indicators

### **App Lifecycle**
- Handle app backgrounding/foregrounding
- Clean up on app termination
- Restore state on app restart

## 🔒 **Privacy & Security**

### **Data Minimal**
Only stores:
- `isOnline: boolean`
- `lastSeen: timestamp`
- No additional personal information

### **Access Control**
- Teachers can update their own presence
- Students can read teacher presence of their courses only
- No cross-course data access

## 📱 **Platform Considerations**

### **iOS & Android**
- Native app state listeners
- Platform-specific network detection
- Appropriate notification styling

### **React Native**
- Hook-based architecture
- Async/await patterns
- TypeScript support
- Performance optimization

## 🔮 **Future Enhancements**

### **Advanced Features**
1. **Typing Indicators**: Show when teachers are typing
2. **Last Seen**: Display detailed last seen timestamps
3. **Bulk Notifications**: Aggregate multiple teacher notifications
4. **Rich Presence**: Show what teachers are currently doing

### **Analytics**
1. **Usage Metrics**: Track notification engagement
2. **Performance Monitoring**: Monitor battery/network impact
3. **User Behavior**: Understand notification preferences

## 📈 **Usage Examples**

### **Adding Connectivity Indicator**
```typescript
import ConnectivityIndicator from '../components/ConnectivityIndicator';

// Small icon in header
<ConnectivityIndicator size="small" />

// Medium with text
<ConnectivityIndicator size="medium" showText={true} />

// Large standalone
<ConnectivityIndicator size="large" showText={true} />
```

### **Listening for Teacher Notifications**
```typescript
import { presenceService } from '../services/presenceService';

useEffect(() => {
    const unsubscribe = presenceService.onTeacherOnline((notification) => {
        console.log(`${notification.teacherName} is online in ${notification.courseName}`);
    });
    
    return unsubscribe;
}, []);
```

## 🎯 **Key Benefits**

1. **Real-time Awareness**: Users always know their connection status
2. **Teacher Availability**: Students know when help is available
3. **Improved Engagement**: Timely notifications increase interaction
4. **Modern UX**: Meets user expectations for real-time apps
5. **Battery Efficient**: Minimal impact on device performance
6. **Scalable**: Handles large numbers of users efficiently

---

This implementation provides a robust foundation for real-time presence and connectivity awareness that enhances the educational experience while maintaining optimal performance. 