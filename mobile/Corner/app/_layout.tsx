import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

import { useColorScheme } from '@/hooks/useColorScheme'; import { notificationService } from '../services/notificationService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Initialize notification service when app starts
    const initNotifications = async () => {
      try {
        await notificationService.init();
        console.log('Notification service initialized');
      } catch (error) {
        console.error('Error initializing notification service:', error);
      }
    };

    // Update user's notification token when they log in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await notificationService.updateUserNotificationToken(user.uid);
          console.log('User notification token updated for:', user.uid);
        } catch (error) {
          console.error('Error updating user notification token:', error);
        }
      }
    });

    initNotifications();

    return () => unsubscribe();
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
