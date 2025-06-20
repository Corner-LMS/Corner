// Keep the splash screen visible while we fetch resources
console.log('🔵 [SPLASH] Preventing auto hide...');
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync().then(() => {
  console.log('✅ [SPLASH] Auto hide prevented successfully');
}).catch((error) => {
  console.error('❌ [SPLASH] Failed to prevent auto hide:', error);
});

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { auth } from '../config/ firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/ firebase-config';
import { offlineCacheService } from '../services/offlineCache';
import { presenceService } from '../services/presenceService';
import TeacherOnlineNotification from '../components/TeacherOnlineNotification';
import CustomSplashScreen from '../components/SplashScreen';

import { useColorScheme } from '@/hooks/useColorScheme';
import { notificationService } from '../services/notificationService';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [userRole, setUserRole] = useState<string | null>(null);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize notification service
        const initNotifications = async () => {
          try {
            await notificationService.init();
          } catch (error) {
            console.error('Error initializing notification service:', error);
          }
        };

        // Initialize offline cache when app starts
        offlineCacheService.initializeCache();

        await initNotifications();

        // Pre-load any other resources here if needed
        // await Promise.all([...]);

      } catch (e) {
        console.error('Error in prepare function:', e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady && loaded) {
      // Add a delay to ensure the splash screen is visible
      setTimeout(() => {
        setShowSplash(false);
      }, 3000); // 3 second delay to make splash screen clearly visible
    }
  }, [appIsReady, loaded]);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Update notification token
          await notificationService.updateUserNotificationToken(user.uid);

          // Get user role and initialize presence service
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role;
            setUserRole(role);

            // Initialize presence service based on user role
            try {
              await presenceService.initialize(role);
            } catch (error) {
              console.error('Error initializing presence service:', error);
            }
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
        }
      } else {
        // User logged out - cleanup presence service
        setUserRole(null);
        presenceService.cleanup();
      }
    });

    return () => {
      unsubscribeAuth();
      // Cleanup presence service when app unmounts
      presenceService.cleanup();
    };
  }, []);

  if (!loaded || !appIsReady) {
    return <CustomSplashScreen />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="role" options={{ headerShown: false }} />
          <Stack.Screen name="create-course" options={{ headerShown: false }} />
          <Stack.Screen name="join-course" options={{ headerShown: false }} />
          <Stack.Screen name="course-detail" options={{ headerShown: false }} />
          <Stack.Screen name="discussion-detail" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
          <Stack.Screen name="ai-assistant" options={{ headerShown: false }} />
          <Stack.Screen name="course-resources" options={{ headerShown: false }} />
          <Stack.Screen name="migrate-data" options={{ headerShown: false }} />
          <Stack.Screen name="support" options={{ headerShown: false }} />
        </Stack>

        {/* Global teacher online notification - only for students */}
        {userRole === 'student' && (
          <TeacherOnlineNotification style={{ top: 50 }} />
        )}

        <StatusBar style="auto" />

        {/* Overlay for loading or splash screen */}
        {(showSplash || loading) && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#4f46e5',
            }}
          >
            {showSplash ? (
              <CustomSplashScreen />
            ) : (
              <ActivityIndicator size="large" color="white" />
            )}
          </View>
        )}
      </View>
    </ThemeProvider>
  );
}
