import { useParams, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CourseHeader from './CourseHeader';
import CourseSidebar from './CourseSidebar';
import ModuleList from '../module/ModuleList';
import Announcements from '../announcement';
import axios from 'axios';
import TeacherLayout from '../../layouts/TeacherLayout';
import { FaBookOpen, FaBullhorn, FaComments, FaChartBar, FaFileAlt, FaRobot, FaCog, FaHome, FaAngleRight } from 'react-icons/fa';
import Discussions from '../discussion';
import { fetchUserInfo } from '../../utils/userInfo';
import AIChatInterface from '../ai/AIChatInterface';
const CourseDetails = () => {
    const { courseId } = useParams();
    const location = useLocation();
    const [course, setCourse] = useState(location.state?.course || null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Modules');
    const [user, setUser] = useState(null);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [recentQuestions, setRecentQuestions] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [questions, setQuestions] = useState([]);
    const courseTabs = [
        { name: 'Home', icon: FaHome },
        { name: 'Modules', icon: FaBookOpen },
        { name: 'AI Assistant', icon: FaRobot },
        { name: 'Assignments', icon: FaFileAlt },
        { name: 'Announcements', icon: FaBullhorn },
        { name: 'Discussions', icon: FaComments },
        { name: 'Grades', icon: FaChartBar },
        { name: 'Settings', icon: FaCog },
    ];
    const url = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5001';

   


    useEffect(() => {
        const fetchUser = async () => {
            try {
                const teacherToken = localStorage.getItem('teacherToken');
                const studentToken = localStorage.getItem('studentToken');
                const token = teacherToken || studentToken;
                
                if (!token) {
                    console.log('No token found');
                    return;
                }
                
                // Get userId from JWT token
                const tokenData = JSON.parse(atob(token.split('.')[1]));
                const userId = tokenData.userId;
                
                const userData = await fetchUserInfo(userId);
                if (userData) {
                    setUser(userData);
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        const fetchCourseData = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');
                
                // Fetch course and questions
                const courseResponse = await axios.get(
                    `${url}/corner/course/get-course/${courseId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                
                if (courseResponse.data) {
                    setCourse(courseResponse.data.course);
                    setQuestions(courseResponse.data.questions || []);
                }

                // Fetch announcements
                const announcementsResponse = await axios.get(
                    `${url}/corner/course/${courseId}/get-announcements`,
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );

                if (announcementsResponse.data) {
                    setAnnouncements(announcementsResponse.data.announcements || []);
                }

            } catch (error) {
                console.error('Error fetching course data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (courseId) {
            fetchCourseData();
        }
    }, [courseId, url]);

    useEffect(() => {
        if (activeTab === 'Home') {
            fetchRecentContent();
        }
    }, [activeTab, courseId]);

    
    const fetchRecentContent = async () => {
        try {
            const token = localStorage.getItem('teacherToken') || localStorage.getItem('studentToken');
            
            // Fetch recent announcements
            const announcementsResponse = await axios.get(
                `${url}/corner/course/${courseId}/get-announcements`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRecentAnnouncements(announcementsResponse.data.announcements.slice(0, 3));

            // Fetch recent questions
            const questionsResponse = await axios.get(
                `${url}/corner/course/${courseId}/questions`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRecentQuestions(questionsResponse.data.questions.slice(0, 3));
        } catch (error) {
            console.error('Error fetching recent content:', error);
        }
    };

    if (loading || !user) {
        return <div>Loading...</div>;
    }

    if (!course) {
        return <div>Course not found</div>;
    }

    return (
        <div className="wflex min-h-screen">
            <TeacherLayout>
                <div className="flex-1 ml-2">
                    <CourseHeader course={course} />
                    <div className="flex">
                        <CourseSidebar
                            tabs={courseTabs}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                        <div className="flex-1 p-6">
                            {loading ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500">Loading...</p>
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'Home' && (
                                        <div className="space-y-8">
                                            {/* Recent Announcements Section */}
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h2 className="text-xl font-bold">Recent Announcements</h2>
                                                    {announcements.length > 3 && (
                                                        <button 
                                                            onClick={() => setActiveTab('Announcements')}
                                                            className="text-rose-600 hover:text-rose-700 flex items-center text-sm"
                                                        >
                                                            View All <FaAngleRight className="ml-1" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="space-y-4">
                                                    {announcements && announcements.length > 0 ? (
                                                        [...announcements]
                                                            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                                            .slice(0, 3)
                                                            .map((announcement) => (
                                                                <div key={announcement._id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                                                    <h3 className="font-medium text-gray-900">{announcement.title}</h3>
                                                                    <p className="text-sm text-rose-600 mt-1">
                                                                        Posted on {new Date(announcement.createdAt).toLocaleString()}
                                                                    </p>
                                                                    <p className="mt-2 text-gray-700">{announcement.content}</p>
                                                                </div>
                                                            ))
                                                    ) : (
                                                        <p className="text-gray-500 italic">No announcements yet</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Recent Questions Section */}
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h2 className="text-xl font-bold">Recent Questions</h2>
                                                    {questions.length > 3 && (
                                                        <button 
                                                            onClick={() => setActiveTab('Discussions')}
                                                            className="text-rose-600 hover:text-rose-700 flex items-center text-sm"
                                                        >
                                                            View All <FaAngleRight className="ml-1" />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="space-y-4">
                                                    {questions && questions.length > 0 ? (
                                                        [...questions]
                                                            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                                            .slice(0, 3)
                                                            .map((question) => (
                                                                <div key={question._id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                                                    <h3 className="font-medium text-gray-900">{question.title}</h3>
                                                                    <p className="text-sm text-rose-600 mt-1">
                                                                        Posted by {question.isAnonymous ? 'Anonymous' : question.createdBy?.name} on{' '}
                                                                        {new Date(question.createdAt).toLocaleString()}
                                                                    </p>
                                                                    <p className="mt-2 text-gray-700">
                                                                        {question.content.length > 150 
                                                                            ? question.content.substring(0, 150) + '...' 
                                                                            : question.content
                                                                        }
                                                                    </p>
                                                                    <p className="text-sm text-rose-600 mt-2">
                                                                        {question.comments?.length || 0} comments
                                                                    </p>
                                                                </div>
                                                            ))
                                                    ) : (
                                                        <p className="text-gray-500 italic">No questions yet</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {activeTab === 'Modules' && (
                                        <ModuleList
                                            courseId={course._id}
                                            teacherId={user.role === 'teacher' ? user.userId : null}
                                        />
                                    )}
                                    {activeTab === 'Announcements' && (
                                        <Announcements 
                                            courseId={course._id}
                                            announcements={announcements}
                                            setAnnouncements={setAnnouncements}
                                        />
                                    )}
                                    {activeTab === 'Discussions' && (
                                        <Discussions 
                                            courseId={course._id}
                                            questions={questions}
                                            setQuestions={setQuestions}
                                        />
                                    )}
                                    {activeTab === 'AI Assistant' && (
                                        <AIChatInterface 
                                            courseName={course.name}
                                            courseId={course._id}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </TeacherLayout>
        </div>
    );
};

export default CourseDetails;