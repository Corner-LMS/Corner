import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';

export async function signUp(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
}

export async function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
    return signOut(auth);
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