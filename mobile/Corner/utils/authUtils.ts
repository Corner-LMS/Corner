import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

/**
 * Wait for Firebase auth state to be ready
 * @param timeout - Timeout in milliseconds (default: 10 seconds)
 * @returns Promise that resolves with the user or rejects with an error
 */
export const waitForAuthState = (timeout: number = 10000): Promise<any> => {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Auth state timeout'));
        }, timeout);

        const unsubscribe = auth().onAuthStateChanged((user) => {
            clearTimeout(timeoutId);
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                reject(new Error('No user found'));
            }
        });
    });
};

/**
 * Ensure user has a valid token and is authenticated
 * @param user - Firebase user object
 * @returns Promise that resolves with the refreshed user or rejects with an error
 */
export const ensureValidToken = async (user: any): Promise<any> => {
    try {
        // Force token refresh
        await user.getIdToken(true);

        // Verify user is still authenticated
        const currentUser = auth().currentUser;
        if (!currentUser) {
            throw new Error('Authentication lost during token refresh');
        }

        return currentUser;
    } catch (error: any) {
        console.error('❌ Token refresh failed:', error);
        throw new Error('Authentication failed');
    }
};

/**
 * Check if user document exists and create if needed
 * @param user - Firebase user object
 * @returns Promise that resolves when user document is ready
 */
export const ensureUserDocument = async (user: any): Promise<void> => {
    try {
        const userDoc = await firestore().collection('users').doc(user.uid).get();

        if (!userDoc.exists()) {
            console.log('📝 Creating user document for:', user.email);
            await firestore().collection('users').doc(user.uid).set({
                email: user.email,
                name: user.displayName,
                emailVerified: user.emailVerified,
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                authProvider: 'google',
                photoURL: user.photoURL,
            }, { merge: true });
        }
    } catch (error) {
        console.error('❌ Error ensuring user document:', error);
        throw error;
    }
};

/**
 * Check if user has complete profile (role and school)
 * @param user - Firebase user object
 * @returns Promise that resolves with user data or null if incomplete
 */
export const checkUserProfile = async (user: any): Promise<any> => {
    try {
        const userDoc = await firestore().collection('users').doc(user.uid).get();

        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData?.role && userData?.schoolId) {
                return userData; // Complete profile
            }
        }

        return null; // Incomplete profile
    } catch (error) {
        console.error('❌ Error checking user profile:', error);
        throw error;
    }
};

/**
 * Complete authentication flow with proper error handling
 * @returns Promise that resolves with user data or rejects with error
 */
export const completeAuthFlow = async (): Promise<any> => {
    try {
        // Wait for auth state
        const user = await waitForAuthState();
       
        // Ensure valid token
        const currentUser = await ensureValidToken(user);
        
        // Ensure user document exists
        await ensureUserDocument(currentUser);
       

        // Check profile completeness
        const userData = await checkUserProfile(currentUser);

        return {
            user: currentUser,
            userData,
            hasCompleteProfile: !!userData
        };
    } catch (error: any) {
        console.error('❌ Auth flow failed:', error);
        throw error;
    }
}; 