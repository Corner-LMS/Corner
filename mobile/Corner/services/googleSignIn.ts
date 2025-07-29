import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { crashlyticsUtils } from '../hooks/useCrashlytics';
import { GOOGLE_SIGN_IN_CONFIG } from '../config/googleSignIn';

// Configure Google Sign-In
GoogleSignin.configure({
    webClientId: GOOGLE_SIGN_IN_CONFIG.webClientId,
    offlineAccess: GOOGLE_SIGN_IN_CONFIG.offlineAccess,
    hostedDomain: GOOGLE_SIGN_IN_CONFIG.hostedDomain,
    forceCodeForRefreshToken: GOOGLE_SIGN_IN_CONFIG.forceCodeForRefreshToken,
    accountName: '',
});

export interface GoogleSignInResult {
    success: boolean;
    user?: any;
    error?: string;
}

/**
 * Initialize Google Sign-In
 */
export const initializeGoogleSignIn = async () => {
    try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        crashlyticsUtils.log('✅ Google Sign-In initialized successfully');
    } catch (error) {
        console.error('Google Sign-In initialization error:', error);
        crashlyticsUtils.recordError(error as Error, 'Google Sign-In initialization failed');
        throw error;
    }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
    try {
        crashlyticsUtils.log('🔐 Starting Google Sign-In process');

        // Check if your device supports Google Play
        await GoogleSignin.hasPlayServices();

        // Sign out first to force account selection
        try {
            await GoogleSignin.signOut();
        } catch (error) {
            // Ignore sign out errors
            // console.log('Sign out before sign in (expected):', error);
        }

        // Get the users ID token
        await GoogleSignin.signIn();
        const { idToken } = await GoogleSignin.getTokens();

        // Create a Google credential with the token
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);

        // Sign-in the user with the credential
        const userCredential = await auth().signInWithCredential(googleCredential);
        const user = userCredential.user;

        crashlyticsUtils.log(`✅ Google Sign-In successful for: ${user.email}`);

        // Force token refresh to ensure we have a valid token
        await user.getIdToken(true);

        // Verify user is still authenticated after token refresh
        const currentUser = auth().currentUser;
        if (!currentUser) {
            throw new Error('Authentication failed after Google Sign-In');
        }

        // Check if user exists in Firestore
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();

        if (!userDoc.exists()) {
            // Create new user document
            await firestore().collection('users').doc(currentUser.uid).set({
                email: currentUser.email,
                name: currentUser.displayName,
                emailVerified: currentUser.emailVerified,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                authProvider: 'google',
                photoURL: currentUser.photoURL,
                // Don't set role or schoolId - user needs to choose these
            }, { merge: true });

            crashlyticsUtils.log('📝 Created new user document for Google Sign-In - needs role selection');
        } else {
            // Update existing user document
            await firestore().collection('users').doc(currentUser.uid).update({
                lastLoginAt: new Date().toISOString(),
                authProvider: 'google',
                emailVerified: currentUser.emailVerified,
                photoURL: currentUser.photoURL,
            });

            crashlyticsUtils.log('📝 Updated existing user document for Google Sign-In');
        }

        return {
            success: true,
            user: userCredential.user
        };

    } catch (error: any) {
        crashlyticsUtils.recordError(error, 'Google Sign-In error');

        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            return {
                success: false,
                error: 'Sign-in was cancelled by the user.'
            };
        } else if (error.code === statusCodes.IN_PROGRESS) {
            return {
                success: false,
                error: 'Sign-in is already in progress.'
            };
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            return {
                success: false,
                error: 'Google Play Services is not available on this device.'
            };
        } else {
            return {
                success: false,
                error: error.message || 'An unexpected error occurred during Google Sign-In.'
            };
        }
    }
};

/**
 * Sign out from Google
 */
export const signOutFromGoogle = async () => {
    try {
        await GoogleSignin.signOut();
        crashlyticsUtils.log('👋 Google Sign-Out successful');
    } catch (error) {
        console.error('Google Sign-Out error:', error);
        crashlyticsUtils.recordError(error as Error, 'Google Sign-Out failed');
    }
};

/**
 * Check if user is signed in with Google
 */
export const isSignedInWithGoogle = async (): Promise<boolean> => {
    try {
        const user = await GoogleSignin.getCurrentUser();
        return !!user;
    } catch (error) {
        console.error('Error checking Google Sign-In status:', error);
        return false;
    }
};

/**
 * Get current Google user
 */
export const getCurrentGoogleUser = async () => {
    try {
        const user = await GoogleSignin.getCurrentUser();
        return user;
    } catch (error) {
        console.error('Error getting current Google user:', error);
        return null;
    }
};

/**
 * Get all available Google accounts
 */
export const getAvailableAccounts = async () => {
    try {
        const accounts = await GoogleSignin.getCurrentUser();
        return accounts;
    } catch (error) {
        console.error('Error getting available accounts:', error);
        return null;
    }
};

/**
 * Sign in with a specific Google account
 */
export const signInWithSpecificAccount = async (accountName?: string): Promise<GoogleSignInResult> => {
    try {
        crashlyticsUtils.log('🔐 Starting Google Sign-In with specific account');

        // Check if your device supports Google Play
        await GoogleSignin.hasPlayServices();

        // Configure for specific account if provided
        if (accountName) {
            GoogleSignin.configure({
                ...GoogleSignin.configure,
                accountName: accountName,
            });
        }

        // Get the users ID token
        await GoogleSignin.signIn();
        const { idToken } = await GoogleSignin.getTokens();

        // Create a Google credential with the token
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);

        // Sign-in the user with the credential
        const userCredential = await auth().signInWithCredential(googleCredential);
        const user = userCredential.user;

        crashlyticsUtils.log(`✅ Google Sign-In successful for: ${user.email}`);

        // Check if user exists in Firestore
        const userDoc = await firestore().collection('users').doc(user.uid).get();

        if (!userDoc.exists()) {
            // Create new user document
            await firestore().collection('users').doc(user.uid).set({
                email: user.email,
                name: user.displayName,
                emailVerified: user.emailVerified,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                authProvider: 'google',
                photoURL: user.photoURL,
                // Don't set role or schoolId - user needs to choose these
            }, { merge: true });

            crashlyticsUtils.log('📝 Created new user document for Google Sign-In - needs role selection');
        } else {
            // Update existing user document
            await firestore().collection('users').doc(user.uid).update({
                lastLoginAt: new Date().toISOString(),
                authProvider: 'google',
                emailVerified: user.emailVerified,
                photoURL: user.photoURL,
            });

            crashlyticsUtils.log('📝 Updated existing user document for Google Sign-In');
        }

        return {
            success: true,
            user: userCredential.user
        };

    } catch (error: any) {
        let errorMessage = 'Google Sign-In failed';

        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            errorMessage = 'Sign-in was cancelled';
            crashlyticsUtils.log('❌ Google Sign-In cancelled by user');
        } else if (error.code === statusCodes.IN_PROGRESS) {
            errorMessage = 'Sign-in is already in progress';
            crashlyticsUtils.log('⚠️ Google Sign-In already in progress');
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            errorMessage = 'Google Play Services not available';
            crashlyticsUtils.log('❌ Google Play Services not available');
        } else {
            errorMessage = 'Google Sign-In failed. Please try again.';
            crashlyticsUtils.recordError(error, 'Google Sign-In failed');
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}; 