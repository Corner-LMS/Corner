// src/hooks/useAutoLogout.js
import { useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';

const useAutoLogout = () => {
    // const navigate = useNavigate();

    useEffect(() => {
        let timer;

        const resetTimer = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                localStorage.removeItem('teacherToken');
                localStorage.removeItem('studentToken');
                window.location.href = '/login';  // Redirect to login page after 10 minutes of inactivity
            }, 1800000);  // 10 minutes in milliseconds
        };

        const events = ['mousemove', 'keydown', 'scroll', 'click'];
        events.forEach((event) => {
            window.addEventListener(event, resetTimer);
        });

        resetTimer(); // Set the initial timer

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, resetTimer);
            });
            clearTimeout(timer);
        };
    }, []);
};

export default useAutoLogout;
