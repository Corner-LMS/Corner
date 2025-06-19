import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, googleProvider } from '../../config/ firebase-config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { registerForPushNotifications } from '../../utils/notifications';

// Configure Google Sign-In
GoogleSignin.configure({
    webClientId: '899702669451-2nk8tic847gjvv3m57rb5okdic1bs0vc.apps.googleusercontent.com',
    offlineAccess: true,
});

// Clear Google Sign-In state
export async function clearGoogleSignInState() {
    try {
        await GoogleSignin.signOut();
    } catch (error) {
        throw error;
    }
}

export async function signUp(email: string, password: string) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Register for push notifications
        const pushToken = await registerForPushNotifications();
        await setDoc(doc(db, "users", userCredential.user.uid), {
            pushToken,
            email: userCredential.user.email,
        }, { merge: true });
        return userCredential;
    } catch (error: any) {
        throw error;
    }
}

export async function login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Register for push notifications
    const pushToken = await registerForPushNotifications();
    await setDoc(doc(db, "users", userCredential.user.uid), {
        pushToken,
        email: userCredential.user.email,
    }, { merge: true });
    return userCredential;
}

export async function logout() {
    try {
        await clearGoogleSignInState();
        await signOut(auth);
    } catch (error) {
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
        await GoogleSignin.hasPlayServices();
        await clearGoogleSignInState();
        const userInfo = await GoogleSignin.signIn();
        const { idToken } = await GoogleSignin.getTokens();
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;

        // Register for push notifications
        const pushToken = await registerForPushNotifications();

        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                name: user.displayName,
                photoURL: user.photoURL,
                createdAt: new Date().toISOString(),
                pushToken,
            });
            return null;
        } else {
            // Update push token for existing user
            await setDoc(doc(db, "users", user.uid), {
                pushToken,
            }, { merge: true });
            return userCredential;
        }
    } catch (error: any) {
        throw error;
    }
}