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

        if (!user.emailVerified) {
            crashlyticsUtils.log(`❌ Login failed - email not verified: ${email}`);
            await firestore().collection('users').doc(user.uid).update({ emailVerified: false });
            throw new Error('Please verify your email before signing in.');
        }

        await firestore().collection('users').doc(user.uid).update({
            emailVerified: true,
            lastLoginAt: new Date().toISOString(),
        });

        crashlyticsUtils.log(`✅ Login successful for: ${email}`);
        return userCredential;
    } catch (error: any) {
        crashlyticsUtils.recordError(error, `Login failed for ${email}`);
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
        throw new Error(getFriendlyErrorMessage(error));
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
            crashlyticsUtils.log('✅ Google Sign-In successful from authService');
            return result.user;
        } else {
            crashlyticsUtils.log(`❌ Google Sign-In failed: ${result.error}`);
            throw new Error(result.error || 'Google Sign-In failed');
        }
    } catch (error: any) {
        crashlyticsUtils.recordError(error, 'Google Sign-In error in authService');
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