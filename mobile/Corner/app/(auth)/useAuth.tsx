import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, googleProvider } from '../../config/ firebase-config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

// Configure Google Sign-In
console.log('=== INITIALIZING GOOGLE SIGN-IN CONFIGURATION ===');
try {
    GoogleSignin.configure({
        webClientId: '899702669451-2nk8tic847gjvv3m57rb5okdic1bs0vc.apps.googleusercontent.com',
    });
    console.log('✅ Google Sign-In configuration successful');
} catch (error) {
    console.error('❌ Google Sign-In configuration failed:', error);
}

// Clear Google Sign-In state
export async function clearGoogleSignInState() {
    try {
        await GoogleSignin.signOut();
        console.log('Google Sign-In state cleared');
    } catch (error) {
        console.error('Error clearing Google Sign-In state:', error);
    }
}

export async function signUp(email: string, password: string) {
    try {
        console.log('Starting email/password sign-up process...');
        console.log('Creating user with Firebase Auth...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('Firebase Auth sign-up successful, user:', JSON.stringify({
            uid: userCredential.user.uid,
            email: userCredential.user.email
        }, null, 2));
        return userCredential;
    } catch (error: any) {
        console.error('Detailed Sign-Up Error:', {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            stack: error?.stack,
            fullError: JSON.stringify(error, null, 2)
        });
        throw error;
    }
}

export async function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
    try {
        // Clear Google Sign-In state first
        await clearGoogleSignInState();
        // Then sign out from Firebase
        await signOut(auth);
        console.log('User logged out successfully');
    } catch (error) {
        console.error('Error during logout:', error);
        throw error;
    }
}

export async function resetPassword(email: string) {
    return sendPasswordResetEmail(auth, email);
}

export async function saveUserRole(role: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    await setDoc(doc(db, "users", user.uid), {
        role,
        email: user.email,
    }, { merge: true });
}

export async function saveUserName(name: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    await setDoc(doc(db, "users", user.uid), {
        name,
        email: user.email,
    }, { merge: true });
}

export async function saveUserSchool(schoolId: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("No user logged in");

    await setDoc(doc(db, "users", user.uid), {
        schoolId,
        email: user.email,
    }, { merge: true });
}

export async function signInWithGoogle() {
    try {
        console.log('Starting Google Sign-In process...');
        await GoogleSignin.hasPlayServices();
        console.log('Play Services check passed');

        // Clear any existing Google Sign-In state
        await clearGoogleSignInState();

        console.log('Attempting to sign in with Google...');
        const userInfo = await GoogleSignin.signIn();
        console.log('Google Sign-In successful, user info:', JSON.stringify(userInfo, null, 2));

        // Get the ID token
        console.log('Getting ID token...');
        const { idToken } = await GoogleSignin.getTokens();
        console.log('ID token obtained successfully');

        // Create a Google credential with the token
        console.log('Creating Firebase credential...');
        const credential = GoogleAuthProvider.credential(idToken);

        // Sign in with the credential
        console.log('Signing in to Firebase...');
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;
        console.log('Firebase sign-in successful, user:', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        }, null, 2));

        // Check if user exists in Firestore
        console.log('Checking Firestore for existing user...');
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            console.log('New user detected, creating user document in Firestore...');
            // Create new user document if it doesn't exist
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                name: user.displayName,
                photoURL: user.photoURL,
                createdAt: new Date().toISOString(),
                // Don't set role or schoolId here - let them choose it
            });
            console.log('New user document created successfully');
            // Return null to indicate new user
            return null;
        } else {
            console.log('Existing user document found:', userDoc.data());
            // Return the user data for existing users
            return userCredential;
        }
    } catch (error: any) {
        console.error('Detailed Google Sign-In Error:', {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            stack: error?.stack,
            fullError: JSON.stringify(error, null, 2)
        });
        throw error;
    }
}