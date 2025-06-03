export const getCurrentRole = () => {
    const studentToken = localStorage.getItem('studentToken');
    const teacherToken = localStorage.getItem('teacherToken');

    const isValidToken = (token) => {
        if (!token) {
            return false;
        }
        try {
            const payload = token.split('.')[1];
            if (!payload) {
                return false;
            }

            const decoded = JSON.parse(atob(payload));

            return decoded &&
                decoded.exp &&
                decoded.exp * 1000 > Date.now() &&
                (decoded.role === 'student' || decoded.role === 'teacher');
        } catch (error) {
            return false;
        }
    };

    if (isValidToken(studentToken)) {
        if (teacherToken) localStorage.removeItem('teacherToken');
        return 'student';
    }

    if (isValidToken(teacherToken)) {
        if (studentToken) localStorage.removeItem('studentToken');
        return 'teacher';
    }

    localStorage.removeItem('studentToken');
    localStorage.removeItem('teacherToken');
    return null;
};