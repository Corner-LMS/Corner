import React, { useState, useEffect } from 'react';
import { signupUser } from '../services/auth';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/signupPage.css';

const Signup = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: '', school: '' });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [schools, setSchools] = useState([]);
    const [isLoadingSchools, setIsLoadingSchools] = useState(true);
    

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
    
    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const response = await axios.get(`${baseUrl}/corner/admin/verified-schools`);
                setSchools(response.data);
            }
            catch (error) {
                console.error('Failed to fetch schools:', error);
                setError('Failed to fetch schools. Please try again later.');
            } finally {
                setIsLoadingSchools(false);
            }
        };
        fetchSchools();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (name === 'school') {
            setFormData({ ...formData, school: value });
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.school && formData.role !== 'admin') {
            setError('Please select a school.');
            return;
        }
        try {
            const data = await signupUser(formData);
            setMessage("Signup successful! Please verify your email to be able to login.");
            setTimeout(() => {
                navigate('/login');
            }, 1000);
        } catch (error) {
            console.error('Signup failed:', error);
            setError("Signup failed. Please try again.");
        }
    };

    return (
        <div className="container d-flex justify-content-center align-items-center vh-100">
            <div className="card shadow p-4" style={{ maxWidth: '400px', width: '100%' }}>
                <h2 className="text-center mb-4 text-primary">Signup</h2>
                <h5 className="text-center mb-4 text-muted">Already have an account? <Link to="/login">Login</Link></h5>
                {error && <div className="alert alert-danger text-center">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="name" className="form-label">Name</label>
                        <input
                            id="name"
                            className="form-control"
                            type="text"
                            name="name"
                            placeholder="Name"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="email" className="form-label">Email</label>
                        <input
                            id="email"
                            className="form-control"
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="password" className="form-label">Password</label>
                        <input
                            id="password"
                            className="form-control"
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={formData.password}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="role" className="form-label">Role</label>
                        <select
                            id="role"
                            className="form-select"
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                        >
                            <option value="">Select Role</option>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    {formData.role !== 'admin' && (
                        <div className="mb-3">
                            <label htmlFor="school" className="form-label">School</label>
                            <select
                                id="school"
                                className="form-select"
                                name="school"
                                value={formData.school}
                                onChange={handleChange}
                            >
                                <option value="" disabled>Select Your School</option>
                                {schools.map((school) => (
                                    <option key={school._id} value={school._id}>{school.name}</option>  // Using _id as value
                                ))}
                            </select>
                        </div>
                    )}
                    {formData.role === 'admin' && (
                        <div className="mb-3">
                            <label htmlFor="school" className="form-label">School Name</label>
                            <input
                                id="schoolName"
                                className="form-control"
                                type="text"
                                name="schoolName"
                                placeholder="School Name"
                                value={formData.schoolName}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <button className="btn btn-primary w-100" type="submit">
                        Sign Up
                    </button>
                </form>

                {message && <div className="alert alert-success text-center mt-3">{message}</div>}
            </div>
        </div>
    );
};

export default Signup;
