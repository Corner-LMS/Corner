// src/components/LogoutButton.js
import React from 'react';
import '../styles/logoutbtn.css';
import { useNavigate } from 'react-router-dom';
const LogoutButton = () => {
    const navigate = useNavigate();
    // Check if the user is logged in (either student or teacher token)
    const isLoggedIn = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');

    const handleLogout = () => {
        // Clear tokens from localStorage
        localStorage.removeItem('teacherToken');
        localStorage.removeItem('studentToken');

        // Redirect to the login page
        navigate('/login');
    };

    if (!isLoggedIn) return null;  // Don't show button if not logged in

    return (
        <button className="logout-button" onClick={handleLogout}>
            Logout
        </button>
    );
};

export default LogoutButton;
