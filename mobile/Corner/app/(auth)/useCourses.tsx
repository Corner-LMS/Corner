import { db } from '../../config/ firebase-config';
import { collection, addDoc } from 'firebase/firestore';

function generateCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createCourse(name: string, description: string, teacherId: string, instructorName: string) {
    const code = generateCode();
    const courseRef = await addDoc(collection(db, 'courses'), {
        name,
        description,
        code,
        teacherId,
        instructorName,
        createdAt: new Date().toISOString()
    });
    return { id: courseRef.id, code };
}
