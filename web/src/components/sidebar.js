import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios'; // For making API calls
import '../styles/sidebar.css';
import cornerLogo from '../images/logo.jpg';
import 'bootstrap/dist/css/bootstrap.min.css';

const Sidebar = () => {
    const [isAccountModalVisible, setAccountModalVisible] = useState(false);
    const [user, setUser] = useState({ name: '', role: '' });
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');

    // Fetch user info from the backend
    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const response = await axios.get('http://localhost:5001/corner/user/get-user-info', {
                    headers: {
                        Authorization: `Bearer ${token}`, // Replace with your token retrieval logic
                    },
                });
                
                setUser(response.data);
                console.log('User info fetched:', response.data);
            } catch (error) {
                console.error('Error fetching user info:', error);
            }
        };

        fetchUserInfo();
    }, []);

    const handleLogout = () => {
        // Clear token or session storage
        localStorage.removeItem(token); // Replace with your logout logic
        window.location.href = '/home'; // Optionally redirect to login
    };

    return (
        <div className="sidebar">

            
            <div className="logo">
                <img src={cornerLogo} alt="Logo" />
            </div>
            <div className="menu">
                <NavLink
                    to="/teacher-dashboard"
                    className={({ isActive }) =>
                        isActive ? 'menu-item active' : 'menu-item'
                    }
                >
                    <i className="dashboard-icon"></i>
                    <span>Dashboard</span>
                </NavLink>
                <div
                    className="menu-item"
                    onClick={() => setAccountModalVisible(true)}
                >
                    <i className="account-icon"></i>
                    <span>Account</span>
                </div>
                <div className="menu-item">
                    <i className="logout-icon"></i>
                    <span>Logout</span>
                </div>
            </div>

            {/* Bootstrap Modal */}
            {isAccountModalVisible && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    role="dialog"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                >
                    <div className="modal-dialog" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Account Details</h5>
                                <button
                                    type="button"
                                    className="close"
                                    data-dismiss="modal"
                                    aria-label="Close"
                                    onClick={() => setAccountModalVisible(false)}
                                >
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div className="modal-body">
                                {user && (
                                    <>
                                        <p><strong>Name:</strong> {user.name}</p>
                                        <p><strong>Role:</strong> {user.role}</p>
                                    </>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setAccountModalVisible(false)}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleLogout}
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
