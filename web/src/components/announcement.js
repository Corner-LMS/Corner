import React, { useState, useEffect } from "react";
import axios from "axios";

const Announcements = ({ courseId }) => {
    const [announcements, setAnnouncements] = useState([]);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "" });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const token = localStorage.getItem('studentToken') || localStorage.getItem('teacherToken');

    // Fetch existing announcements

    const getsUserRole = () =>{
        const token = localStorage.getItem('teacherToken');
        if (token) {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            return decodedToken.role;
        }
        return null;
    }
    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const response = await axios.get(
                    `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5001"}/corner/course/${courseId}/get-announcements`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`  // Add token in Authorization header
                        }
                    }
                );
                if (response.status === 200) {
                    setAnnouncements(response.data.announcements);
                } else {
                    setError("Failed to fetch announcements.");
                }
            } catch (err) {
                setError("Error fetching announcements.");
            }
        };

        fetchAnnouncements();
    }, [courseId, token]);

    // Handle form submission
    const handleAddAnnouncement = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
            setError("Title and content are required.");
            return;
        }

        if (!token) {
            setError("Authentication failed. Please log in.");
            return;
        }

        try {
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5001"}/corner/course/${courseId}/add-announcement`,
                newAnnouncement,
                {
                    headers: {
                        Authorization: `Bearer ${token}`  // Add token in Authorization header
                    }
                }
            );

            if (response.status === 201) {
                setSuccess("Announcement added successfully!");
                setNewAnnouncement({ title: "", content: "" });
                // Update announcements list
                setAnnouncements((prevAnnouncements) => [response.data.announcement, ...prevAnnouncements]);
            } else {
                setError("Failed to add announcement.");
            }
        } catch (err) {
            setError("Error adding announcement.");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Course Announcements</h2>
            </div>

            {/* Add new announcement form */}
            {getsUserRole() === 'teacher' && (
                <form onSubmit={handleAddAnnouncement} className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="mb-4">
                        <label htmlFor="announcementTitle" className="block text-sm font-medium text-gray-700">
                            Title
                        </label>
                        <input
                            type="text"
                            id="announcementTitle"
                            className="mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2"
                            value={newAnnouncement.title}
                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                            placeholder="Enter announcement title"
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="announcementContent" className="block text-sm font-medium text-gray-700">
                            Content
                        </label>
                        <textarea
                            id="announcementContent"
                            className="mt-1 block w-full rounded-md border-gray-600 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2"
                            value={newAnnouncement.content}
                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                            placeholder="Enter announcement content"
                            rows="3"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="bg-rose-600 text-white px-4 py-2 rounded-md hover:bg-rose-700"
                    >
                        Add Announcement
                    </button>
                </form>
            )}

            {error && <p className="text-red-600">{error}</p>}
            {success && <p className="text-green-600">{success}</p>}

            {/* List of announcements */}
            <div className="space-y-4">
                {announcements && announcements.length > 0 ? (
                    announcements.map((announcement) => (
                        <div key={announcement._id} className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-lg font-medium text-gray-900">{announcement.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {new Date(announcement.createdAt).toLocaleString()}
                            </p>
                            <p className="mt-2 text-gray-700">{announcement.content}</p>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 text-center py-4">No announcements yet. Stay tuned!</p>
                )}
            </div>
        </div>
    );
};

export default Announcements;
