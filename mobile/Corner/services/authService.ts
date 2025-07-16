import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { crashlyticsUtils } from '../hooks/useCrashlytics';
import { signInWithGoogle, signOutFromGoogle, initializeGoogleSignIn } from './googleSignIn';

function getFriendlyErrorMessage(error: any): string {
    const errorCode = error?.code || '';
    switch (errorCode) {
        case 'auth/user-not-found':
            return 'No account found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/email-already-in-use':
            return 'Email already in use.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        case 'auth/operation-not-allowed':
            return 'Email/password sign in is not enabled.';
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        default:
            return 'An unexpected error occurred. Try again.';
    }
}

export async function signUp(email: string, password: string) {
    try {
        const userCredential = await auth().createUserWithEmailAndPassword(email, password);
        await userCredential.user.sendEmailVerification();
        await firestore().collection('users').doc(userCredential.user.uid).set({
            email,
            emailVerified: false,
            createdAt: new Date().toISOString(),
        }, { merge: true });
        return userCredential;
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
}

export async function login(email: string, password: string) {
    try {
        crashlyticsUtils.log(`🔐 Login attempt for: ${email}`);
        const userCredential = await auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Check if email is verified
        if (!user.emailVerified) {
            crashlyticsUtils.log(`❌ Login failed - email not verified: ${email}`);
            await firestore().collection('users').doc(user.uid).update({ emailVerified: false });
            await auth().signOut(); // Sign out the user immediately
            throw new Error('Please verify your email before signing in.');
        }

        // Check if user has role and school assigned
        const userDoc = await firestore().collection('users').doc(user.uid).get();
        if (!userDoc.exists()) {
            crashlyticsUtils.log(`❌ Login failed - user document not found: ${email}`);
            await auth().signOut(); // Sign out the user immediately
            throw new Error('User profile not found. Please contact support.');
        }

        const userData = userDoc.data();

        // Check if user has a role assigned
        if (!userData?.role) {
            crashlyticsUtils.log(`❌ Login failed - no role assigned: ${email}`);
            await auth().signOut(); // Sign out the user immediately
            throw new Error('Your account is not properly configured. Please contact support to assign your role.');
        }

        // Check if user has a school assigned
        if (!userData?.schoolId) {
            crashlyticsUtils.log(`❌ Login failed - no school assigned: ${email}`);
            await auth().signOut(); // Sign out the user immediately
            throw new Error('Your account is not associated with any school. Please contact support.');
        }

        // All checks passed - update last login time
        await firestore().collection('users').doc(user.uid).update({
            emailVerified: true,
            lastLoginAt: new Date().toISOString(),
        });

        crashlyticsUtils.log(`✅ Login successful for: ${email}`);
        return userCredential;
    } catch (error: any) {
        crashlyticsUtils.recordError(error, `Login failed for ${email}`);

        // If it's our custom error messages, preserve them
        if (error.message === 'Please verify your email before signing in.' ||
            error.message === 'User profile not found. Please contact support.' ||
            error.message === 'Your account is not properly configured. Please contact support to assign your role.' ||
            error.message === 'Your account is not associated with any school. Please contact support.') {
            throw error;
        }

        // Otherwise, use the friendly error message for Firebase errors
        throw new Error(getFriendlyErrorMessage(error));
    }
}

export async function logout() {
    try {
        await auth().signOut();
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
}

export async function resetPassword(email: string) {
    try {
        return await auth().sendPasswordResetEmail(email);
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
}

export async function sendVerificationEmail() {
    const user = auth().currentUser;
    if (!user) throw new Error('No user signed in.');
    if (user.emailVerified) throw new Error('Email already verified.');

    try {
        await user.sendEmailVerification();
    } catch (error: any) {
        const errorCode = error?.code || '';
        switch (errorCode) {
            case 'auth/too-many-requests':
                throw new Error('Too many verification emails sent. Please wait a few minutes before trying again.');
            case 'auth/network-request-failed':
                throw new Error('Network error. Please check your internet connection and try again.');
            case 'auth/user-not-found':
                throw new Error('User not found. Please sign in again.');
            case 'auth/invalid-user-token':
                throw new Error('Session expired. Please sign in again.');
            case 'auth/user-token-expired':
                throw new Error('Session expired. Please sign in again.');
            case 'auth/requires-recent-login':
                throw new Error('Please sign in again to send verification email.');
            default:
                console.error('Email verification error:', error);
                throw new Error('Failed to send verification email. Please try again.');
        }
    }
}

export async function saveUserField(field: string, value: string) {
    const user = auth().currentUser;
    if (!user) throw new Error('No user logged in');
    return firestore().collection('users').doc(user.uid).set(
        {
            [field]: value,
            email: user.email,
            emailVerified: user.emailVerified,
        },
        { merge: true }
    );
}

export const saveUserRole = (role: string) => saveUserField('role', role);
export const saveUserName = (name: string) => saveUserField('name', name);
export const saveUserSchool = (schoolId: string) => saveUserField('schoolId', schoolId);

/**
 * Google Sign-In functions
 */
export const googleSignIn = async () => {
    try {
        crashlyticsUtils.log('🔐 Starting Google Sign-In from authService');
        const result = await signInWithGoogle();
        if (result.success) {
            const user = auth().currentUser;
            if (!user) {
                throw new Error('Google Sign-In failed - no user returned');
            }

            // Check if email is verified
            if (!user.emailVerified) {
                crashlyticsUtils.log(`❌ Google Sign-In failed - email not verified: ${user.email}`);
                await firestore().collection('users').doc(user.uid).update({ emailVerified: false });
                await auth().signOut(); // Sign out the user immediately
                throw new Error('Please verify your email before signing in.');
            }

            // Check if user has role and school assigned
            const userDoc = await firestore().collection('users').doc(user.uid).get();
            if (!userDoc.exists()) {
                crashlyticsUtils.log(`❌ Google Sign-In failed - user document not found: ${user.email}`);
                await auth().signOut(); // Sign out the user immediately
                throw new Error('User profile not found. Please contact support.');
            }

            const userData = userDoc.data();

            // Check if user has a role assigned
            if (!userData?.role) {
                crashlyticsUtils.log(`❌ Google Sign-In failed - no role assigned: ${user.email}`);
                await auth().signOut(); // Sign out the user immediately
                throw new Error('Your account is not properly configured. Please contact support to assign your role.');
            }

            // Check if user has a school assigned
            if (!userData?.schoolId) {
                crashlyticsUtils.log(`❌ Google Sign-In failed - no school assigned: ${user.email}`);
                await auth().signOut(); // Sign out the user immediately
                throw new Error('Your account is not associated with any school. Please contact support.');
            }

            // All checks passed - update last login time
            await firestore().collection('users').doc(user.uid).update({
                emailVerified: true,
                lastLoginAt: new Date().toISOString(),
            });

            crashlyticsUtils.log('✅ Google Sign-In successful from authService');
            return result.user;
        } else {
            crashlyticsUtils.log(`❌ Google Sign-In failed: ${result.error}`);
            throw new Error(result.error || 'Google Sign-In failed');
        }
    } catch (error: any) {
        crashlyticsUtils.recordError(error, 'Google Sign-In error in authService');

        // If it's our custom error messages, preserve them
        if (error.message === 'Please verify your email before signing in.' ||
            error.message === 'User profile not found. Please contact support.' ||
            error.message === 'Your account is not properly configured. Please contact support to assign your role.' ||
            error.message === 'Your account is not associated with any school. Please contact support.' ||
            error.message === 'Google Sign-In failed - no user returned') {
            throw error;
        }

        // If it's already a friendly error message from our service, use it
        if (error.message && !error.message.includes('An unexpected error occurred')) {
            throw error;
        }
        // Otherwise, use the friendly error message
        throw new Error(getFriendlyErrorMessage(error));
    }
};

export const googleSignOut = async () => {
    try {
        await signOutFromGoogle();
        await logout(); // Also sign out from Firebase
    } catch (error: any) {
        throw new Error(getFriendlyErrorMessage(error));
    }
};

export const initializeGoogleAuth = async () => {
    try {
        await initializeGoogleSignIn();
    } catch (error: any) {
        console.error('Failed to initialize Google Sign-In:', error);
        // Don't throw here as it's not critical for app startup
    }
}; 