import { useEffect, useRef } from 'react';
import crashlytics from '@react-native-firebase/crashlytics';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { usePathname } from 'expo-router';

interface UserAttributes {
    role?: string;
    email?: string;
    name?: string;
    schoolId?: string;
    emailVerified?: boolean;
}
console.log('🔵 [CRASHLYTICS] Initializing Crashlytics...');

/**
 * Utility functions for manual Crashlytics logging
 */
export const crashlyticsUtils = {
    log: (message: string) => {
        try {
            crashlytics().log(message);
        } catch (error) {
            console.warn('Crashlytics not available:', error);
        }
    },

    recordError: (error: Error, context?: string) => {
        try {
            if (context) {
                crashlytics().log(`Error context: ${context}`);
            }
            crashlytics().recordError(error);
        } catch (crashlyticsError) {
            console.warn('Crashlytics not available:', crashlyticsError);
        }
    },

    setAttribute: (key: string, value: string) => {
        try {
            crashlytics().setAttribute(key, value);
        } catch (error) {
            console.warn('Crashlytics not available:', error);
        }
    },

    setAttributes: (attributes: Record<string, string>) => {
        try {
            crashlytics().setAttributes(attributes);
        } catch (error) {
            console.warn('Crashlytics not available:', error);
        }
    }
};

/**
 * Hook to initialize and track common Crashlytics metadata
 * Integrates with existing Firebase auth system
 */
export const useCrashlyticsTracking = () => {
    const pathname = usePathname();
    const lastScreenRef = useRef<string>('');
    const lastUserIdRef = useRef<string>('');

    useEffect(() => {
        // Check if Crashlytics is available
        try {
            // Log app start
            crashlytics().log('🚀 App started');
        } catch (error) {
            console.warn('Crashlytics not available, skipping initialization:', error);
            return; // Exit early if Crashlytics is not available
        }

        // Optional: catch any unhandled JS exceptions (Crashlytics catches fatal native ones already)
        const globalErrorHandler = (error: any, isFatal?: boolean) => {
            try {
                crashlytics().recordError(error);
                crashlytics().log(`💥 Global error captured (fatal=${isFatal})`);
            } catch (crashlyticsError) {
                console.warn('Crashlytics not available for error logging:', crashlyticsError);
            }
        };

        // Safely handle ErrorUtils - it might not be available in all environments
        try {
            const previousHandler = ErrorUtils?.getGlobalHandler?.();
            if (ErrorUtils?.setGlobalHandler) {
                ErrorUtils.setGlobalHandler(globalErrorHandler);
            }

            return () => {
                // Optional cleanup: restore the old handler
                if (previousHandler && ErrorUtils?.setGlobalHandler) {
                    ErrorUtils.setGlobalHandler(previousHandler);
                }
            };
        } catch (error) {
            console.warn('ErrorUtils not available, skipping global error handler setup:', error);
            try {
                crashlytics().log('⚠️ ErrorUtils not available, using default error handling');
            } catch (crashlyticsError) {
                console.warn('Crashlytics not available:', crashlyticsError);
            }
            return () => { }; // No cleanup needed
        }
    }, []);

    // Track screen changes
    useEffect(() => {
        if (pathname && pathname !== lastScreenRef.current) {
            try {
                crashlytics().log(`📱 Screen: ${pathname}`);
            } catch (error) {
                console.warn('Crashlytics not available for screen tracking:', error);
            }
            lastScreenRef.current = pathname;
        }
    }, [pathname]);

    // Track user authentication state
    useEffect(() => {
        const unsubscribeAuth = auth().onAuthStateChanged(async (user) => {
            if (user && user.uid !== lastUserIdRef.current) {
                try {
                    // Set user ID
                    crashlytics().setUserId(user.uid);
                    crashlytics().log(`👤 User ID set: ${user.uid}`);
                    lastUserIdRef.current = user.uid;

                    // Get user data from Firestore
                    const userDoc = await firestore().collection('users').doc(user.uid).get();
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData) {
                            const attributes: UserAttributes = {
                                role: userData.role,
                                email: userData.email || user.email || undefined,
                                name: userData.name,
                                schoolId: userData.schoolId,
                                emailVerified: userData.emailVerified
                            };

                            // Filter out undefined values
                            const filteredAttributes = Object.fromEntries(
                                Object.entries(attributes).filter(([_, value]) => value !== undefined)
                            );

                            if (Object.keys(filteredAttributes).length > 0) {
                                crashlytics().setAttributes(filteredAttributes);
                                crashlytics().log(`🔖 User attributes set: ${JSON.stringify(filteredAttributes)}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error setting Crashlytics user data:', error);
                    try {
                        crashlytics().recordError(error as Error);
                    } catch (crashlyticsError) {
                        console.warn('Crashlytics not available for error logging:', crashlyticsError);
                    }
                }
            } else if (!user && lastUserIdRef.current) {
                // User logged out
                try {
                    crashlytics().setUserId('');
                    crashlytics().log('👤 User logged out');
                } catch (error) {
                    console.warn('Crashlytics not available for logout tracking:', error);
                }
                lastUserIdRef.current = '';
            }
        });

        return () => unsubscribeAuth();
    }, []);
};
