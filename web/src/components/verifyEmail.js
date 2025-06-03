// VerifyEmail.js (Frontend React)
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const VerifyEmail = () => {
    const { token } = useParams();  // Get the token from the URL
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL||'http://localhost:5001';

    useEffect(() => {
        const verifyUserEmail = async () => {
            try {
                const response = await axios.get(`${baseUrl}/corner/auth/verify-email/${token}`);
                setMessage(response.data.message);
                setTimeout(() => {
                    navigate('/login');  // Redirect to login page after verification
                }, 1000);  // Wait 2 seconds before redirecting
            } catch (error) {
                console.error('Verification failed:', error);
                setError('Verification failed. Please try again.');
            }
        };

        if (token) {
            verifyUserEmail();
        }
    }, [token, navigate]);

    return (
        <div className="container d-flex justify-content-center align-items-center vh-100">
            <div className="card shadow p-4" style={{ maxWidth: '400px', width: '100%' }}>
                <h2 className="text-center mb-4 text-primary">Verify Email</h2>
                {message && <div className="alert alert-success text-center">{message}</div>}
                {error && <div className="alert alert-danger text-center">{error}</div>}
            </div>
        </div>
    );
};

export default VerifyEmail;
