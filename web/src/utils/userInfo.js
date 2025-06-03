import axios from 'axios';

export const fetchUserInfo = async (userId) => {
    try {
        const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
        const token = localStorage.getItem('studentToken') || localStorage.getItem('teacherToken');
        
        const response = await axios.get(`${url}/corner/user/get-user-info/${userId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching user info:', error);
        return null;
    }
};