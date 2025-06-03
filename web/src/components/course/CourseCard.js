import { useNavigate } from 'react-router-dom';

const CourseCard = ({ course }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(`/courses/${course._id}`, { state: { course } });
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow" onClick={handleClick}>
            <div className="p-4">
                <h3 className="font-medium text-rose-700">{course.name}</h3>
                <p className="text-gray-500 text-sm mt-1">{course.description}</p>
            </div>
            <div className="px-4 py-2 bg-gray-300">
                    <p className="text-xs text-gray-500">
                    Created: {new Date(course.createdAt).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
};

export default CourseCard;