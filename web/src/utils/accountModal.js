import React from 'react';

const AccountModal = ({ accountModalVisible, setAccountModalVisible, user, onLogout }) => {
    if(!accountModalVisible) return null;
   
    console.log("user: ", user);
    console.log("user role: ", user.role);
    return (
        <>
            {accountModalVisible && (
                <div className="modal show d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                    <div className="modal-dialog" role="document">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Account Details</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    aria-label="Close"
                                    onClick={() => setAccountModalVisible(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {user.name && user.role && user.school? (
                                    <>
                                        <p>
                                            <strong>Name:</strong> {user.name}
                                        </p>
                                        <p>
                                            <strong>Role:</strong> {user.role}
                                        </p>
                                        <p>
                                            <strong>School:</strong> {user.school}
                                        </p>
                                    </>
                                ) : (
                                    <p>Loading user details...</p>
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
                                    onClick={onLogout}
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AccountModal;
