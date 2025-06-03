// src/api.js
import axios from 'axios';


const API_URL = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001'}/corner/auth`;

// Function to register a user
export const signupUser = async (userData) => {
    try {
        const response = await axios.post(`${API_URL}/signup`, userData);
        return response.data;
    } catch (error) {
        console.error("Error signing up:", error.message);
        throw error;
    }
};

// Function to log in a user
export const loginUser = async (credentials) => {
    try {
        const response = await axios.post(`${API_URL}/login`, credentials);
        return response.data;
    } catch (error) {
        console.error("Error logging in:", error.message);
        throw error;
    }
};
