import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../../config/ firebase-config';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
// import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

// Configure Google Sign-In
// console.log('Configuring Google Sign-In...');
// GoogleSignin.configure({
//     webClientId: '899702669451-2nk8tic847gjvv3m57rb5okdic1bs0vc.apps.googleusercontent.com',
//     offlineAccess: true,
// });

// Clear Google Sign-In state
// export async function clearGoogleSignInState() {
//     try {
//         await GoogleSignin.signOut();
//     } catch (error) {
//         throw error;
//     }
// }

// Function to convert Firebase error codes to friendly messages
function getFriendlyErrorMessage(error: any): string {
    const errorCode = error?.code || '';

    switch (errorCode) {
        // Authentication errors
        case 'auth/user-not-found':
            return 'No account found with this email address. Please check your email or create a new account.';

        case 'auth/wrong-password':
            return 'Incorrect password. Please try again or reset your password.';

        case 'auth/invalid-email':
            return 'Please enter a valid email address.';

        case 'auth/weak-password':
            return 'Password is too weak. Please use at least 8 characters with numbers and special characters.';

        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Please sign in instead.';

        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later or reset your password.';

        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection and try again.';

        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact support for assistance.';

        case 'auth/invalid-credential':
            return 'Invalid email or password. Please check your credentials and try again.';

        case 'auth/operation-not-allowed':
            return 'This operation is not allowed. Please contact support.';

        case 'auth/requires-recent-login':
            return 'For security reasons, please sign in again.';

        // Email verification errors
        case 'auth/email-not-verified':
            return 'Please verify your email address before signing in. Check your inbox for a verification link.';

        // Password reset errors
        case 'auth/user-not-found':
            return 'No account found with this email address.';

        // Generic error
        default:
            return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
}

export async function signUp(email: string, password: string) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Send email verification
        await sendEmailVerification(userCredential.user);

        // Create user document in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
            email: userCredential.user.email,
            emailVerified: false,
            createdAt: new Date().toISOString(),
        }, { merge: true });

        return userCredential;
    } catch (error: any) {
        // Convert Firebase error to friendly message
        const friendlyError = new Error(getFriendlyErrorMessage(error));
        friendlyError.name = error?.code || 'auth/unknown-error';
        throw friendlyError;
    }
}

export async function login(email: string, password: string) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Check if email is verified
        if (!userCredential.user.emailVerified) {
            // Update Firestore to reflect current verification status
            await updateDoc(doc(db, "users", userCredential.user.uid), {
                emailVerified: userCredential.user.emailVerified,
            } as any);

            throw new Error('Please verify your email before signing in. Check your inbox for a verification link.');
        }

        // Update Firestore to reflect current verification status
        await updateDoc(doc(db, "users", userCredential.user.uid), {
            emailVerified: userCredential.user.emailVerified,
            lastLoginAt: new Date().toISOString(),
        } as any);

        return userCredential;
    } catch (error: any) {
        // If it's our custom email verification error, keep it as is
        if (error.message === 'Please verify your email before signing in. Check your inbox for a verification link.') {
            throw error;
        }

        // Convert Firebase error to friendly message
        const friendlyError = new Error(getFriendlyErrorMessage(error));
        friendlyError.name = error?.code || 'auth/unknown-error';
        throw friendlyError;
    }
}

export async function logout() {
    try {
        // await clearGoogleSignInState();
        await signOut(auth);
    } catch (error: any) {
        const friendlyError = new Error(getFriendlyErrorMessage(error));
        friendlyError.name = error?.code || 'auth/unknown-error';
        throw friendlyError;
    }
}

export async function resetPassword(email: string) {
    try {
        return await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
        const friendlyError = new Error(getFriendlyErrorMessage(error));
        friendlyError.name = error?.code || 'auth/unknown-error';
        throw friendlyError;
    }
}

export async function sendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('No user is currently signed in');
    }

    if (user.emailVerified) {
        throw new Error('Email is already verified');
    }

    try {
        await sendEmailVerification(user);
    } catch (error: any) {
        const friendlyError = new Error(getFriendlyErrorMessage(error));
        friendlyError.name = error?.code || 'auth/unknown-error';
        throw friendlyError;
    }
}

export async function saveUserRole(role: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    await setDoc(doc(db, "users", user.uid), {
        role,
        email: user.email,
        emailVerified: user.emailVerified,
    }, { merge: true });
}

export async function saveUserName(name: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    await setDoc(doc(db, "users", user.uid), {
        name,
        email: user.email,
        emailVerified: user.emailVerified,
    }, { merge: true });
}

export async function saveUserSchool(schoolId: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    await setDoc(doc(db, "users", user.uid), {
        schoolId,
        email: user.email,
        emailVerified: user.emailVerified,
    }, { merge: true });
}

// console.log('[TRYING GOOGLE SIGN IN]');
// export async function signInWithGoogle() {
//     try {
//         console.log('[GoogleSignIn] Checking Play Services...');
//         await GoogleSignin.hasPlayServices();
//         console.log('[GoogleSignIn] Play Services available. Clearing state...');
//         await clearGoogleSignInState();
//         console.log('[GoogleSignIn] State cleared. Starting signIn...');
//         const userInfo = await GoogleSignin.signIn();
//         console.log('[GoogleSignIn] signIn success:', userInfo);
//         const { idToken } = await GoogleSignin.getTokens();
//         console.log('[GoogleSignIn] Got tokens:', idToken);
//         const credential = GoogleAuthProvider.credential(idToken);
//         const userCredential = await signInWithCredential(auth, credential);
//         const user = userCredential.user;
//         console.log('[GoogleSignIn] Firebase signInWithCredential success:', user.uid);

//         const userDoc = await getDoc(doc(db, "users", user.uid));
//         console.log('[GoogleSignIn] Got userDoc:', userDoc.exists());

//         if (!userDoc.exists()) {
//             await setDoc(doc(db, "users", user.uid), {
//                 email: user.email,
//                 name: user.displayName,
//                 photoURL: user.photoURL,
//                 createdAt: new Date().toISOString(),
//                 emailVerified: true, // Google accounts are pre-verified
//             });
//             console.log('[GoogleSignIn] New user document created.');
//             return null;
//         } else {
//             console.log('[GoogleSignIn] Existing user, returning userCredential.');
//             return userCredential;
//         }
//     } catch (error: any) {
//         console.error('[GoogleSignIn] Error during signInWithGoogle:', error);
//         throw error;
//     }
// }