import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/home.css';

const Home = () => {
    return (
        <div className="min-h-screen bg-gray-400 flex flex-col items-center justify-center p-4">
            <div className="welcome-text mb-8">
                <h1 className="text-4xl font-bold text-white text-center mb-4">Welcome to Corner!</h1>
                <p className="text-xl text-gray-50 text-center">
                    Your hub for engaging in course discussions, asking questions, and collaborating with peers and instructors.
                </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
                <Link to="/login" className="px-6 py-3 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors">Login</Link>
                <Link to="/signup" className="px-6 py-3 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors">Sign Up</Link>
                <Link to="/register-school" className="px-6 py-3 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors">Register School</Link>
                <Link to="https://cornerdiscussion.netlify.app/" className="px-6 py-3 bg-rose-700 text-white rounded-lg hover:bg-rose-800 transition-colors">About Corner Discussion</Link>
            </div>
        </div>
    );
};

export default Home;