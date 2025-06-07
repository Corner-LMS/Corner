# Push Notifications Setup Guide

This guide will help you set up push notifications for the Corner mobile app.

## Required Dependencies

First, install the required packages:

```bash
cd mobile/Corner
npx expo install expo-notifications expo-device
```

## Configuration

### 1. Uncomment Notification Code

After installing the dependencies, uncomment the notification service imports in the following files:

- `app/_layout.tsx` (lines 11, 25, 35)
- `app/course-detail.tsx` (line 8, 66, 69)
- `app/discussion-detail.tsx` (line 8, 57)
- `app/notification-settings.tsx` (line 8, 78-85, 95)
- `services/notificationHelpers.ts` (already uncommented - just install dependencies)

### 2. Notification Icon Assets

Create proper notification icon assets:

1. Replace `assets/images/notification-icon.png` with a proper 24x24px notification bell icon
2. Ensure the icon follows platform guidelines:
   - iOS: Use transparency and avoid color fills
   - Android: Can include color and gradients

### 3. Expo Configuration

The app.json has been configured with notification settings. If you need custom notification plugins, add this to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#81171b",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ]
  }
}
```

### 4. Firebase Cloud Messaging (Optional)

For production apps, you may want to set up Firebase Cloud Messaging:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > Cloud Messaging
4. Add your iOS/Android apps if not already added
5. Download the configuration files

### 5. EAS Build Configuration

For building with EAS Build, add to your `eas.json`:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

## Notification Badge System

The app includes a smart notification badge system:

### Visual Components
- **Notification Badge**: Shows in the dashboard header for students
- **Unread Count**: Red badge with number of unread notifications
- **New Notification Indicator**: Pulsing red dot for recent notifications
- **Icon Changes**: Bell icon fills when there are unread notifications

### Badge Behavior
- **Increments**: When notifications are sent to the user
- **Updates Real-time**: Uses Firestore listeners for instant updates
- **Clears**: When user taps the notification badge or clears notifications
- **Multi-device Sync**: Badge count syncs across all user devices

### Badge States
1. **No notifications**: Empty bell outline icon
2. **Unread notifications**: Filled bell icon with red badge showing count
3. **New notifications**: Pulsing effect on badge for recent notifications
4. **99+ notifications**: Shows "99+" for counts over 99

## Notification Types

The app implements three types of notifications:

### 1. Announcement Notifications
- **Trigger**: When a teacher posts a new announcement
- **Recipients**: All students enrolled in the course
- **Badge**: +1 for each student
- **Example**: "New Announcement in Math 101: Quiz Next Week"

### 2. Discussion Milestone Notifications
- **Trigger**: Every 10 discussion posts in a course
- **Recipients**: All students in the course (except the author of the 10th post)
- **Badge**: +1 for each eligible student
- **Example**: "Active Discussion in Math 101: 20 discussions and counting! Join the conversation."

### 3. Reply Notifications
- **Trigger**: When a student's discussion post receives exactly 3 replies
- **Recipients**: The original discussion author (if they're a student)
- **Badge**: +1 for the author
- **Example**: "Your Discussion is Popular! Your post 'Help with Calculus' has received 3 replies in Math 101"

## Features

- **Notification Badge**: Real-time badge with unread count on dashboard
- **User Settings**: Students can control which notifications they receive
- **Sound & Vibration**: Customizable notification behavior
- **Test Notifications**: Users can test their notification setup
- **Clear All**: Button to clear all notification badges
- **Multi-device Support**: Notifications work across multiple devices for the same user
- **Graceful Failures**: App continues to work even if notifications fail
- **Smart Badge Management**: Automatic badge count management

## Usage

### Notification Badge Location
The notification badge appears in the dashboard header for students only. Teachers don't receive notifications, so they don't see the badge.

### Badge Interactions
- **Tap Badge**: Opens notification settings
- **Badge Updates**: Real-time updates when notifications arrive
- **Clear Notifications**: Use the "Clear All Notifications" button in settings

### Accessing Notification Settings
Students can access notification settings by:
1. Tapping the notification badge in the dashboard header
2. Navigating directly to `/notification-settings`

### Testing Notifications
The notification settings screen includes:
- "Send Test Notification" button to verify setup
- "Clear All Notifications" button to reset badge count

### Notification Permissions
The app automatically requests notification permissions when first launched. Users can manage these through their device settings.

## Development Notes

- Notifications require a physical device for testing (not simulator/emulator)
- Badge counts are stored in Firestore under `users/{userId}/notificationData`
- Expo push notifications are free for development and small-scale production
- For large-scale production, consider implementing your own push notification service
- All notification logic includes error handling to prevent app crashes

## Data Structure

The notification data is stored in Firestore as:

```typescript
// users/{userId}
{
  notificationData: {
    unreadCount: number,           // Total unread notifications
    lastNotificationTime: Date,    // When last notification was received
    lastSeenTime: Date            // When user last viewed notifications
  },
  notificationSettings: {
    announcementNotifications: boolean,
    discussionMilestoneNotifications: boolean,
    replyNotifications: boolean,
    soundEnabled: boolean,
    vibrationEnabled: boolean
  }
}
```

## Troubleshooting

### Common Issues

1. **Badge not updating**
   - Check Firestore rules allow user document updates
   - Verify user is authenticated
   - Check console for Firestore listener errors

2. **No notifications received**
   - Check device notification permissions
   - Ensure app is running on a physical device
   - Verify user has enabled relevant notification types in settings

3. **Badge count incorrect**
   - Use "Clear All Notifications" button to reset
   - Check for multiple notification triggers
   - Verify notification helper functions are being called

4. **Build errors**
   - Make sure all dependencies are installed
   - Check Expo CLI version compatibility
   - Clear Metro cache: `npx expo start --clear`

5. **Token registration failures**
   - Check internet connectivity
   - Verify Firebase configuration (if using FCM)
   - Review device logs for error messages

### Testing Checklist

- [ ] Dependencies installed
- [ ] Notification permissions granted
- [ ] Badge appears for students on dashboard
- [ ] Badge count increments when notifications sent
- [ ] Badge clears when "Clear All" pressed
- [ ] Test notification works
- [ ] Announcement notifications trigger (teacher posts)
- [ ] Discussion milestone notifications trigger (10th post)
- [ ] Reply notifications trigger (3rd reply to student post)
- [ ] Settings persist correctly
- [ ] Multiple devices receive notifications
- [ ] Badge syncs across devices

## Security Considerations

- Expo push tokens are stored securely in Firestore
- Notifications only send relevant information (no sensitive data)
- Users can opt out of any notification type
- Badge counts are user-specific and private
- Token cleanup happens when users sign out

## Next Steps

1. Install dependencies
2. Uncomment notification code
3. Replace notification icon placeholder with proper icon
4. Test badge system on physical device
5. Configure push notification service (optional)
6. Deploy and monitor notification performance 