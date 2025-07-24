import * as Notifications from 'expo-notifications';
// import { Platform } from 'react-native';
// import { doc, collection, getDocs, query, where } from 'firebase/firestore';
// import { db } from '../config/ firebase-config';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true
    }),
});

// All push notification logic removed. Only in-app notification handler remains. 