// Migration script to add schoolId to existing courses
// Run this once to update all courses created before school-based system was implemented

import firestore, { doc } from '@react-native-firebase/firestore';

interface Course {
    id: string;
    teacherId: string;
    schoolId?: string;
    name: string;
    instructorName?: string;
}

interface User {
    id: string;
    schoolId?: string;
    name: string;
    role: string;
}

async function migrateCourseSchools() {
    console.log('🔄 Starting course school migration...');

    try {
        // Get all courses
        const coursesSnapshot = await firestore().collection('courses').get();
        const courses: Course[] = coursesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Course));

        console.log(`📚 Found ${courses.length} courses to check`);

        // Filter courses that don't have schoolId
        const coursesWithoutSchool = courses.filter(course => !course.schoolId);
        console.log(`🔍 Found ${coursesWithoutSchool.length} courses without school association`);

        if (coursesWithoutSchool.length === 0) {
            console.log('✅ All courses already have school associations!');
            return;
        }

        // Get all users (we need to check teachers)
        const usersSnapshot = await firestore().collection('users').get();
        const users: User[] = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as User));

        console.log(`👥 Found ${users.length} users`);

        // Create a map of teacherId -> schoolId
        const teacherSchoolMap: Record<string, string> = {};
        users.forEach(user => {
            if (user.role === 'teacher' && user.schoolId) {
                teacherSchoolMap[user.id] = user.schoolId;
            }
        });

        console.log(`🏫 Found ${Object.keys(teacherSchoolMap).length} teachers with school associations`);

        // Use batch updates for better performance
        const batch = firestore().batch();
        let updateCount = 0;
        let skipCount = 0;

        for (const course of coursesWithoutSchool) {
            const teacherSchoolId = teacherSchoolMap[course.teacherId];

            if (teacherSchoolId) {
                const courseRef = firestore().collection('courses').doc(course.id);
                batch.update(courseRef, {
                    schoolId: teacherSchoolId
                });
                updateCount++;
                console.log(`🔗 Will update course "${course.name}" with school ID: ${teacherSchoolId}`);
            } else {
                skipCount++;
                console.log(`⚠️  Skipping course "${course.name}" - teacher ${course.teacherId} has no school association`);
            }
        }

        if (updateCount > 0) {
            // Commit the batch
            await batch.commit();
            console.log(`✅ Successfully updated ${updateCount} courses with school associations`);
        }

        if (skipCount > 0) {
            console.log(`⚠️  Skipped ${skipCount} courses (teachers without school associations)`);
        }

        console.log('🎉 Migration completed!');

        // Summary
        console.log('\n📊 Migration Summary:');
        console.log(`   Total courses: ${courses.length}`);
        console.log(`   Already had school: ${courses.length - coursesWithoutSchool.length}`);
        console.log(`   Updated with school: ${updateCount}`);
        console.log(`   Skipped (no teacher school): ${skipCount}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Export for use in other scripts or manual execution
export { migrateCourseSchools };

// If running directly
if (require.main === module) {
    migrateCourseSchools()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
} 