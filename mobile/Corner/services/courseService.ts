import firestore from '@react-native-firebase/firestore';

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createCourse(name: string, description: string, teacherId: string, instructorName: string) {
    const code = generateCode();

    // Get teacher's school from their profile
    let schoolId = null;
    try {
        const teacherDoc = await firestore().collection('users').doc(teacherId).get();
        if (teacherDoc.exists()) {
            const teacherData = teacherDoc.data();
            schoolId = teacherData?.schoolId || null;
        }
    } catch (error) {
        console.error('Error fetching teacher school:', error);
    }

    const courseRef = await firestore().collection('courses').add({
        name,
        description,
        code,
        teacherId,
        instructorName,
        schoolId,
        createdAt: new Date().toISOString(),
    });

    return { id: courseRef.id, code };
} 