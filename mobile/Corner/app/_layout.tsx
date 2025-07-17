// Keep the splash screen visible while we fetch resources

// Suppress React Native Firebase deprecation warnings
import '../utils/suppress-warnings';

import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync().then(() => {
  // Auto hide prevented successfully
}).catch((error) => {
  console.error('❌ [SPLASH] Failed to prevent auto hide:', error);
});

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, AppState, AppStateStatus } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { offlineCacheService } from '../services/offlineCache';
import { presenceService } from '../services/presenceService';
import { draftManager } from '../services/draftManager';
import TeacherOnlineNotification from '../components/TeacherOnlineNotification';
import CustomSplashScreen from '../components/SplashScreen';
import ToastNotification from '../components/ToastNotification';
//  import { initializeCrashlytics } from '../utils/crashlytics-utils';
import { useCrashlyticsTracking } from '../hooks/useCrashlytics';
import { initializeGoogleAuth } from '../services/authService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

import { useColorScheme } from '@/hooks/useColorScheme';
import { notificationService } from '../services/notificationService';


export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isOnline, hasReconnected } = useNetworkStatus();

  // Initialize Crashlytics tracking
  useCrashlyticsTracking();

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [userRole, setUserRole] = useState<string | null>(null);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authStateResolved, setAuthStateResolved] = useState(false);
  const [toastConfig, setToastConfig] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'info'
  });

  // Global draft sync when device comes back online
  useEffect(() => {
    if (hasReconnected && isOnline) {
      const syncGlobalDrafts = async () => {
        try {
          const result = await draftManager.syncAllDrafts();
          if (result.syncedCount > 0) {
            setToastConfig({
              visible: true,
              message: `Successfully synced ${result.syncedCount} draft${result.syncedCount > 1 ? 's' : ''}`,
              type: 'success'
            });
          }
          if (result.failedCount > 0) {
            setToastConfig({
              visible: true,
              message: `${result.failedCount} draft${result.failedCount > 1 ? 's' : ''} failed to sync`,
              type: 'warning'
            });
          }
        } catch (error) {
          console.error('Error in global draft sync:', error);
          setToastConfig({
            visible: true,
            message: 'Error syncing drafts',
            type: 'error'
          });
        }
      };

      syncGlobalDrafts();
    }
  }, [hasReconnected, isOnline]);

  // Periodic background sync when online
  useEffect(() => {
    if (!isOnline) return;

    const syncInterval = setInterval(async () => {
      try {
        const pendingDrafts = await draftManager.getPendingDrafts();
        if (pendingDrafts.length > 0) {
          const result = await draftManager.syncAllDrafts();
          if (result.syncedCount > 0) {
            setToastConfig({
              visible: true,
              message: `Synced ${result.syncedCount} draft${result.syncedCount > 1 ? 's' : ''}`,
              type: 'success'
            });
          }
        }
      } catch (error) {
        console.error('Error in background draft sync:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(syncInterval);
  }, [isOnline]);

  // Sync drafts when app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isOnline) {
        try {
          const pendingDrafts = await draftManager.getPendingDrafts();
          if (pendingDrafts.length > 0) {
            const result = await draftManager.syncAllDrafts();
            if (result.syncedCount > 0) {
              setToastConfig({
                visible: true,
                message: `Synced ${result.syncedCount} draft${result.syncedCount > 1 ? 's' : ''}`,
                type: 'success'
              });
            }
          }
        } catch (error) {
          console.error('Error in app foreground draft sync:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isOnline]);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize offline cache when app starts
        offlineCacheService.initializeCache();

        // Initialize Google Sign-In
        await initializeGoogleAuth();

        // Initialize notification service
        await notificationService.initialize();

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
    if (appIsReady && loaded && authStateResolved) {
      // Add a delay to ensure the splash screen is visible
      setTimeout(() => {
        setShowSplash(false);
      }, 3000); // 3 second delay to make splash screen clearly visible
    }
  }, [appIsReady, loaded, authStateResolved]);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribeAuth = auth().onAuthStateChanged(async (user) => {
      setLoading(true);
      try {
        if (user) {
          // Get user role and initialize presence service
          const userDoc = await firestore().collection('users').doc(user.uid).get();
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData) {
              const role = userData.role;
              const schoolId = userData.schoolId;

              if (role && schoolId) {
                // User has role and school, set role and initialize presence service
                setUserRole(role);

                // Initialize presence service based on user role
                try {
                  await presenceService.initialize(role);
                } catch (error) {
                  console.error('Error initializing presence service:', error);
                }

                // Update push token for logged in user
                try {
                  await notificationService.updatePushToken(user.uid);
                } catch (error) {
                  console.error('Error updating push token:', error);
                }
              } else {
                // User doesn't have role or school, redirect to role selection
                setUserRole(null);
                presenceService.cleanup();
              }
            } else {
              // User document doesn't exist, redirect to role selection
              setUserRole(null);
              presenceService.cleanup();
            }
          } else {
            // User document doesn't exist, redirect to role selection
            setUserRole(null);
            presenceService.cleanup();
          }
        } else {
          // User logged out - cleanup presence service
          setUserRole(null);
          presenceService.cleanup();
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
      } finally {
        setLoading(false);
        setAuthStateResolved(true);
      }
    });

    return () => {
      unsubscribeAuth();
      // Cleanup presence service when app unmounts
      presenceService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

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
          <Stack.Screen name="feedback" options={{ headerShown: false }} />
          <Stack.Screen name="survey" options={{ headerShown: false }} />
          <Stack.Screen name="admin-dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="super-admin-dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="manage-students" options={{ headerShown: false }} />
          <Stack.Screen name="compose-message" options={{ headerShown: false }} />
          <Stack.Screen name="message-detail" options={{ headerShown: false }} />
          <Stack.Screen name="conversation" options={{ headerShown: false }} />
          <Stack.Screen name="course-compose-message" options={{ headerShown: false }} />
          <Stack.Screen name="course-conversation" options={{ headerShown: false }} />
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
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color="white" />
                <Text style={{ color: 'white', marginTop: 16, fontSize: 16, fontWeight: '600' }}>
                  Setting up your account...
                </Text>
              </View>
            )}
          </View>
        )}
        {toastConfig.visible && (
          <ToastNotification
            visible={toastConfig.visible}
            message={toastConfig.message}
            type={toastConfig.type}
            onHide={() => setToastConfig({ ...toastConfig, visible: false })}
          />
        )}
      </View>
    </ThemeProvider>
  );
}
