// ModuleItemList.js
import { useState, useEffect } from 'react';
import ModuleItemCard from './ModuleItemCard';
import axios from 'axios';

export default function ModuleItemList({ moduleId, teacherId }) {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');

    const fetchItems = async () => {
        if (!moduleId) return; // Don't fetch if no moduleId

        setIsLoading(true);
        setError(null);

        try {
            const res = await axios.get(`${url}/corner/module-items/${moduleId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setItems(res.data);
        } catch (err) {
            console.error('Failed to fetch items:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Add moduleId to dependency array and ensure it's stable
    useEffect(() => {
        fetchItems();
    }, [moduleId, token]); // Add token as dependency

    if (error) return <div className="p-4 text-center text-red-600">Error: {error}</div>;
    if (isLoading) return <div className="p-4 text-center">Loading...</div>;

    return (
        <div className="divide-y divide-gray-300 bg-white">
            <ModuleItemCard 
                moduleId={moduleId}
                items={items || []}
                onItemsUpdate={(updatedItems) => {
                    setItems(updatedItems || []);
                }}
            />
        </div>
    );
}