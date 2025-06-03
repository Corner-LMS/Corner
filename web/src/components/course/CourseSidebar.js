import { useNavigate } from 'react-router-dom';

const CourseSidebar = ({ tabs, activeTab, setActiveTab }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('teacherToken');
        localStorage.removeItem('studentToken');
        navigate('/login');
    };

    return (
        <div className="w-56 p-4 bg-gray-100 border-r border-gray-300">
            <nav className="space-y-1">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.name;

                return (
                    <button
                        key={tab.name}
                        onClick={() => setActiveTab(tab.name)}
                        className={`w-full text-left flex items-center px-3 py-2 rounded-md text-sm font-medium ${isActive
                                ? 'text-rose-700'
                                : 'text-gray-600 hover:bg-rose-100 '
                            }`}
                    >
                        <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-rose-700' : 'text-gray-400'}`} />
                        {tab.name}
                    </button>
                );
            })}
        </nav>
        <button onClick={handleLogout} className="mt-4 w-full text-left flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-rose-100">
            Logout
        </button>
        </div>
    );
};

export default CourseSidebar;