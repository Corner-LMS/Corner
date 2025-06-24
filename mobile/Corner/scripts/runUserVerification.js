#!/usr/bin/env node

// Script to mark all existing users as email verified
// Run this script once to avoid email verification errors for existing users

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyDKporoD94nICcjOF6ZH3QD7tEmjS4mOCE",
    authDomain: "corner-70a1e.firebaseapp.com",
    projectId: "corner-70a1e",
    storageBucket: "corner-70a1e.firebasestorage.app",
    messagingSenderId: "899702669451",
    appId: "1:899702669451:web:e602527afb3003ff0fd48e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function markAllUsersVerified() {
    try {
        console.log('🚀 Starting to mark all users as verified...');

        // Get all users from Firestore
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);

        console.log(`📊 Found ${usersSnapshot.size} users to process`);

        let updatedCount = 0;
        let alreadyVerifiedCount = 0;
        let errorCount = 0;

        // Process each user
        for (const userDoc of usersSnapshot.docs) {
            try {
                const userData = userDoc.data();

                // Check if user already has emailVerified field
                if (userData.emailVerified === undefined) {
                    // Update user to mark as verified
                    await updateDoc(doc(db, 'users', userDoc.id), {
                        emailVerified: true,
                        emailVerifiedAt: new Date().toISOString()
                    });
                    updatedCount++;
                    console.log(`✅ Marked user ${userData.email || userDoc.id} as verified`);
                } else if (userData.emailVerified === true) {
                    alreadyVerifiedCount++;
                    console.log(`ℹ️  User ${userData.email || userDoc.id} already verified`);
                } else {
                    // User exists but emailVerified is false, update to true
                    await updateDoc(doc(db, 'users', userDoc.id), {
                        emailVerified: true,
                        emailVerifiedAt: new Date().toISOString()
                    });
                    updatedCount++;
                    console.log(`✅ Updated user ${userData.email || userDoc.id} to verified`);
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ Error processing user ${userDoc.id}:`, error.message);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`- Total users processed: ${usersSnapshot.size}`);
        console.log(`- Users marked as verified: ${updatedCount}`);
        console.log(`- Users already verified: ${alreadyVerifiedCount}`);
        console.log(`- Errors encountered: ${errorCount}`);
        console.log('\n✅ All existing users have been marked as email verified!');

        if (errorCount > 0) {
            console.log(`⚠️  ${errorCount} users had errors during processing. Check the logs above.`);
        }

    } catch (error) {
        console.error('❌ Error marking users as verified:', error);
        throw error;
    }
}

// Run the script
console.log('🔧 Corner App - User Email Verification Script');
console.log('==============================================\n');

markAllUsersVerified()
    .then(() => {
        console.log('\n🎉 Script completed successfully!');
        console.log('📧 Email verification is now enabled for new users.');
        console.log('🔐 Existing users can now sign in without verification issues.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    }); 