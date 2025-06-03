import React, { useState, useEffect } from 'react';
import axios from 'axios';

const RegisterSchool = () => {
    const [schoolName, setSchoolName] = useState('');
    const [registeredSchools, setRegisteredSchools] = useState([]);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';

    useEffect(() => {
        const fetchRegisteredSchools = async () => {
            try {
                const response = await axios.get(`${baseUrl}/corner/schoolregister/schools`);
                setRegisteredSchools(response.data.schools);
            } catch (error) {
                console.error('Failed to fetch registered schools:', error);
            }
        };
        fetchRegisteredSchools();
    }, []);

    const handleRegisterSchool = async (e) => {
        e.preventDefault();
        try {
            // const response = await axios.post(`${baseUrl}/corner/schoolregister/register-school`, {
            //     name: schoolName,
            // });
            // setRegisteredSchools((prev) => [...prev, response.data.school]);
            // setSchoolName('');
            // alert('School registered successfully!');
            try {
                await axios.post(`${baseUrl}/corner/schoolregister/register-school`, {
                    name: schoolName,
                });
                setSchoolName('');
                alert('School registered successfully!');
                // Refetch the schools to ensure up-to-date state
                const response = await axios.get(`${baseUrl}/corner/schoolregister/schools`);
                setRegisteredSchools(response.data.schools);
            } catch (error) {
                console.error('Failed to register school:', error);
                alert('Failed to register school. Please try again.');
            }
        } catch (error) {
            console.error('Failed to register school:', error);
            alert('Failed to register school. Please try again.');
        }
    };

    return (
        <div className="container my-4">
            <form onSubmit={handleRegisterSchool} className="mb-4">
                <div className="mb-3">
                    <label htmlFor="schoolName" className="form-label">
                        School Name
                    </label>
                    <input
                        type="text"
                        id="schoolName"
                        className="form-control"
                        placeholder="Enter school name"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary">
                    Register School
                </button>
            </form>
            <h2 className="mb-3">Registered Schools</h2>
            <ul className="list-group">
                {registeredSchools.map((school) => (
                    <li key={school.code} className="list-group-item">
                        {school.name} <span className="text-muted">(Code: {school.code})</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RegisterSchool;