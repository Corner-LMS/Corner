import React from 'react';

const Navbar = ({ fetchUserInfo, setAccountModalVisible }) => {
    return (
        <nav className="navbar navbar-expand-lg navbar-dark custom-navbar">
            <div className="container-fluid">
                <a className="navbar-brand" href="/teacher-dashboard">
                    Corner Discussion
                </a>
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarNav"
                    aria-controls="navbarNav"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse justify-content-between" id="navbarNav">
                    <span className="navbar-text">Course Discussion</span>
                    <button
                        className="btn btn-outline-light"
                        onClick={() => {
                            fetchUserInfo(); // Fetch user info on click
                            setAccountModalVisible(true); // Show account modal
                        }}
                    >
                        Account
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
