import { db, auth } from '../../config/ firebase-config';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';

function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createCourse(name: string, description: string, teacherId: string, instructorName: string) {
    const code = generateCode();

    // Get teacher's school from their profile
    let schoolId = null;
    try {
        const teacherDoc = await getDoc(doc(db, 'users', teacherId));
        if (teacherDoc.exists()) {
            const teacherData = teacherDoc.data();
            schoolId = teacherData.schoolId;
        }
    } catch (error) {
        console.error('Error fetching teacher school:', error);
    }

    const courseRef = await addDoc(collection(db, 'courses'), {
        name,
        description,
        code,
        teacherId,
        instructorName,
        schoolId, // Link course to teacher's school
        createdAt: new Date().toISOString()
    });
    return { id: courseRef.id, code };
}
