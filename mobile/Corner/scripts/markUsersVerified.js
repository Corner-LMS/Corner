// Script to mark all existing users as email verified
// Run this script once to avoid email verification errors for existing users

import firestore from '@react-native-firebase/firestore';

async function markAllUsersVerified() {
    try {
        

        // Get all users from Firestore
        const usersCollection = firestore().collection('users');
        const usersSnapshot = await usersCollection.get();

        
        let updatedCount = 0;
        let alreadyVerifiedCount = 0;

        // Process each user
        for (const userDoc of usersSnapshot.docs) {
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
        }

        console.log('\n📊 Summary:');
        console.log(`- Total users processed: ${usersSnapshot.size}`);
        console.log(`- Users marked as verified: ${updatedCount}`);
        console.log(`- Users already verified: ${alreadyVerifiedCount}`);
        console.log('\n✅ All existing users have been marked as email verified!');

    } catch (error) {
        console.error('❌ Error marking users as verified:', error);
        throw error;
    }
}

// Run the script
markAllUsersVerified()
    .then(() => {
        console.log('🎉 Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    }); 