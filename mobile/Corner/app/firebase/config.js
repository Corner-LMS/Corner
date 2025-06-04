// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import {getAuth} from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';


// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDKporoD94nICcjOF6ZH3QD7tEmjS4mOCE",
    authDomain: "corner-70a1e.firebaseapp.com",
    projectId: "corner-70a1e",
    storageBucket: "corner-70a1e.firebasestorage.app",
    messagingSenderId: "899702669451",
    appId: "1:899702669451:web:e602527afb3003ff0fd48e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export { auth };