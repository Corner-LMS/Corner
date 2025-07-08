#!/usr/bin/env node

// Script to mark all existing users as email verified
// Run this script once to avoid email verification errors for existing users
import firestore from '@react-native-firebase/firestore';

async function markAllUsersVerified() {
    try {
        console.log('🚀 Starting to mark all users as verified...');

        // Get all users from Firestore
        const usersCollection = firestore().collection('users');
        const usersSnapshot = await usersCollection.get();

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
                    await firestore().collection('users').doc(userDoc.id).update({
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
                    await firestore().collection('users').doc(userDoc.id).update({
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