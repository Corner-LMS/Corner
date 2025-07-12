import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert, Dimensions, StatusBar, Image } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NotificationBadge from '../../components/NotificationBadge';
import { getSchoolById } from '@/constants/Schools';
import ConnectivityIndicator from '../../components/ConnectivityIndicator';

const { width, height } = Dimensions.get('window');

// Cache for dashboard data
let dashboardCache: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Type definition for CourseCard props
interface CourseCardProps {
    course: any;
    role: string;
    teacherName: string;
    isArchived?: boolean;
    actionIcon?: keyof typeof Ionicons.glyphMap;
    actionColor?: string;
    onAction?: () => void;
    onActionMenu?: () => void;
    children?: React.ReactNode;
}

export default function DashboardScreen() {
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<any[]>([]);
    const [role, setRole] = useState('');
    const [studentCourses, setStudentCourses] = useState<any[]>([]);
    const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
    const [schoolInfo, setSchoolInfo] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);

    // Memoized helper functions
    const getUserInitials = useCallback((user: FirebaseAuthTypes.User, userData: any) => {
        if (userData?.name) {
            const nameParts = userData.name.trim().split(' ');
            if (nameParts.length >= 2) {
                return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
            } else {
                return nameParts[0].substring(0, 2).toUpperCase();
            }
        } else {
            return user.email?.split('@')[0]?.substring(0, 2).toUpperCase() || 'U';
        }
    }, []);

    const getDisplayName = useCallback((user: FirebaseAuthTypes.User, userData: any) => {
        if (userData?.name) {
            const nameParts = userData.name.trim().split(' ');
            return nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
        } else {
            const emailUsername = user.email?.split('@')[0] || '';
            return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1).toLowerCase();
        }
    }, []);

    const getTimeOfDay = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        return 'evening';
    }, []);

    const loadUserAndCourses = useCallback(async (user: FirebaseAuthTypes.User, forceRefresh = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            // Check cache first
            const now = Date.now();
            if (!forceRefresh && dashboardCache && (now - cacheTimestamp) < CACHE_DURATION) {
                const cached = dashboardCache;
                setRole(cached.role);
                setUserData(cached.userData);
                setSchoolInfo(cached.schoolInfo);
                setStudentCourses(cached.studentCourses);
                setCourses(cached.courses);
                setTeacherNames(cached.teacherNames);
                setLoading(false);
                return;
            }

            const userDocSnap = await firestore().collection('users').doc(user.uid).get();

            if (!userDocSnap.exists()) {
                setLoading(false);
                return;
            }

            const userData = userDocSnap.data();

            if (!userData) {
                setLoading(false);
                return;
            }

            if (!userData.role) {
                await firestore().collection('users').doc(user.uid).update({ role: 'student' });
                setRole('student');
            } else {
                setRole(userData.role);
            }

            setUserData(userData);

            if (userData.schoolId) {
                const school = getSchoolById(userData.schoolId);
                setSchoolInfo(school);
            }

            let coursesList: any[] = [];
            let teacherNamesMap: Record<string, string> = {};

            // Optimized: Load data based on role with efficient queries
            if (userData.role === 'student' && userData.courseIds) {
                // For students, fetch only their enrolled courses
                const studentCoursesList = [];
                const studentTeacherNamesMap: Record<string, string> = {};

                // Batch fetch course data
                const coursePromises = userData.courseIds.map(async (courseId: string) => {
                    return firestore().collection('courses').doc(courseId).get();
                });

                const courseSnaps = await Promise.all(coursePromises);

                for (let i = 0; i < courseSnaps.length; i++) {
                    const courseSnap = courseSnaps[i];
                    const courseId = userData.courseIds[i];

                    if (courseSnap.exists()) {
                        const courseData = courseSnap.data();
                        if (courseData) {
                            studentCoursesList.push({
                                ...courseData,
                                id: courseId,
                                joinedAt: userData.courseJoinDates?.[courseId] || new Date().toISOString()
                            });

                            // Fetch teacher name if not already cached
                            if (courseData.teacherId && !studentTeacherNamesMap[courseId]) {
                                const teacherSnap = await firestore().collection('users').doc(courseData.teacherId).get();
                                if (teacherSnap.exists()) {
                                    const teacherData = teacherSnap.data();
                                    if (teacherData) {
                                        studentTeacherNamesMap[courseId] = teacherData.name || 'Unknown Teacher';
                                    }
                                }
                            }
                        }
                    }
                }

                setStudentCourses(studentCoursesList);
                setTeacherNames(studentTeacherNamesMap);
                coursesList = studentCoursesList;
                teacherNamesMap = studentTeacherNamesMap;
            }

            if (userData.role === 'teacher') {
                // For teachers, fetch only their courses
                const snapshot = await firestore()
                    .collection('courses')
                    .where('teacherId', '==', user.uid)
                    .get();
                const teacherCoursesList = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() as any }))
                    .filter((course: any) => course.archived !== true);
                setCourses(teacherCoursesList);
                coursesList = teacherCoursesList;
            }

            if (userData.role === 'admin') {
                const adminSchoolId = userData.schoolId;

                if (!adminSchoolId) {
                    setCourses([]);
                    setTeacherNames({});
                } else {
                    // For admins, fetch courses from their school only
                    const snapshot = await firestore()
                        .collection('courses')
                        .where('schoolId', '==', adminSchoolId)
                        .get();
                    const adminCoursesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
                    setCourses(adminCoursesList);

                    // Batch fetch teacher names
                    const teacherIds = [...new Set(adminCoursesList.map((course: any) => course.teacherId).filter(Boolean))];
                    const adminTeacherNamesMap: Record<string, string> = {};

                    const teacherPromises = teacherIds.map(async (teacherId: string) => {
                        return firestore().collection('users').doc(teacherId).get();
                    });

                    const teacherSnaps = await Promise.all(teacherPromises);

                    teacherSnaps.forEach((teacherSnap, index) => {
                        if (teacherSnap.exists()) {
                            const teacherData = teacherSnap.data();
                            if (teacherData) {
                                adminTeacherNamesMap[teacherIds[index]] = teacherData.name || 'Unknown Teacher';
                            }
                        }
                    });

                    setTeacherNames(adminTeacherNamesMap);
                    coursesList = adminCoursesList;
                    teacherNamesMap = adminTeacherNamesMap;
                }
            }

            // Cache the results
            dashboardCache = {
                role: userData.role || 'student',
                userData,
                schoolInfo: userData.schoolId ? getSchoolById(userData.schoolId) : null,
                studentCourses: userData.role === 'student' ? coursesList : [],
                courses: userData.role === 'teacher' || userData.role === 'admin' ? coursesList : [],
                teacherNames: teacherNamesMap
            };
            cacheTimestamp = now;

        } catch (error) {
            console.error('Error in loadUserAndCourses:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged((user) => {
            setUser(user);
            if (user) {
                loadUserAndCourses(user);
            } else {
                setCourses([]);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [loadUserAndCourses]);

    useFocusEffect(
        React.useCallback(() => {
            const currentUser = auth().currentUser;
            if (currentUser) {
                loadUserAndCourses(currentUser, true); // Force refresh on focus
            }
        }, [loadUserAndCourses])
    );

    const handleUnjoinCourse = useCallback(async (courseId: string, courseName: string) => {
        Alert.alert(
            'Leave Course',
            `Are you sure you want to leave "${courseName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const user = auth().currentUser;
                            if (!user) return;

                            await firestore().collection('users').doc(user.uid).update({
                                courseIds: firestore.FieldValue.arrayRemove(courseId)
                            });

                            setStudentCourses(prev => prev.filter(course => course.id !== courseId));
                            Alert.alert('Success', `You have left "${courseName}".`);
                        } catch (error) {
                            console.error('Error leaving course:', error);
                            Alert.alert('Error', 'Failed to leave course. Please try again.');
                        }
                    }
                }
            ]
        );
    }, []);

    const handleDeleteCourse = useCallback(async (courseId: string, courseName: string) => {
        Alert.alert(
            'Delete Course',
            `Are you sure you want to delete "${courseName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await firestore().collection('courses').doc(courseId).delete();
                            setCourses(prev => prev.filter(course => course.id !== courseId));
                            Alert.alert('Success', `"${courseName}" has been deleted.`);
                        } catch (error) {
                            console.error('Error deleting course:', error);
                            Alert.alert('Error', 'Failed to delete course. Please try again.');
                        }
                    }
                }
            ]
        );
    }, []);

    const handleArchiveCourse = useCallback(async (courseId: string, courseName: string) => {
        Alert.alert(
            'Archive Course',
            `Are you sure you want to archive "${courseName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Archive',
                    onPress: async () => {
                        try {
                            await firestore().collection('courses').doc(courseId).update({
                                archived: true,
                                archivedAt: new Date().toISOString()
                            });
                            setCourses(prev => prev.filter(course => course.id !== courseId));
                            Alert.alert('Success', `"${courseName}" has been archived.`);
                        } catch (error) {
                            console.error('Error archiving course:', error);
                            Alert.alert('Error', 'Failed to archive course. Please try again.');
                        }
                    }
                }
            ]
        );
    }, []);

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.loadingGradient}
                >
                    <View style={styles.loadingContent}>
                        <View style={styles.loadingIcon}>
                            <Image
                                source={require('../../assets/images/corner-splash-logo.png')}
                                style={styles.loadingLogo}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                </LinearGradient>
            </SafeAreaView>
        );
    }

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.welcomeGradient}
                >
                    <View style={styles.welcomeContent}>
                        <View style={styles.welcomeIcon}>
                            <Image
                                source={require('../../assets/images/corner-splash-logo.png')}
                                style={styles.welcomeLogo}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.welcomeTitle}>Welcome to Corner</Text>
                        <Text style={styles.welcomeSubtitle}>
                            Your learning journey starts here
                        </Text>

                        <View style={styles.welcomeButtons}>
                            <TouchableOpacity
                                style={styles.primaryBtn}
                                onPress={() => router.replace('/(auth)/login')}
                            >
                                <Text style={styles.primaryBtnText}>Sign In</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryBtn}
                                onPress={() => router.replace('/(auth)/signup')}
                            >
                                <Text style={styles.secondaryBtnText}>Create Account</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
            {/* Header */}
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <View style={styles.userInfo}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {getUserInitials(user, userData)}
                            </Text>
                        </View>
                        <View>
                            <Text style={styles.schoolName}>{schoolInfo?.name || 'Your School'}</Text>
                            <Text style={styles.greeting}>Good {getTimeOfDay}</Text>
                            <Text style={styles.userName}>{getDisplayName(user, userData)}</Text>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <ConnectivityIndicator size="small" showText={false} />
                        <NotificationBadge size="small" />
                        <TouchableOpacity
                            style={styles.settingsBtn}
                            onPress={() => router.push('/notification-settings')}
                        >
                            <Ionicons name="settings" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.roleContainer}>
                    <Text style={styles.roleText}>{role.toUpperCase()}</Text>
                </View>
            </LinearGradient>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Courses Section */}
                <View style={styles.coursesSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            {role === 'student' ? 'My Courses' :
                                role === 'teacher' ? 'Teaching' : 'School Courses'}
                        </Text>
                        {(role === 'teacher' || role === 'student') && (
                            <TouchableOpacity
                                style={styles.addCourseBtn}
                                onPress={() => router.push(role === 'student' ? '/join-course' : '/create-course')}
                            >
                                <Ionicons name="add" size={20} color="#4f46e5" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#4f46e5" style={styles.loadingIndicator} />
                    ) : role === 'student' && studentCourses.length > 0 ? (
                        studentCourses.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                role={role}
                                teacherName={teacherNames[course.id] || 'Unknown Teacher'}
                                onAction={() => handleUnjoinCourse(course.id, course.name)}
                                actionIcon="exit-outline"
                                actionColor="#ff6b6b"
                            />
                        ))
                    ) : role === 'teacher' && courses.length > 0 ? (
                        courses.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                role={role}
                                teacherName={course.instructorName || 'You'}
                                actionIcon="ellipsis-horizontal"
                                actionColor="#4f46e5"
                                onActionMenu={() => {
                                    Alert.alert(
                                        'Course Actions',
                                        `Choose an action for ${course.name}`,
                                        [
                                            { text: 'Archive', onPress: () => handleArchiveCourse(course.id, course.name) },
                                            { text: 'Delete', style: 'destructive', onPress: () => handleDeleteCourse(course.id, course.name) },
                                            { text: 'Cancel', style: 'cancel' }
                                        ]
                                    );
                                }}
                            />
                        ))
                    ) : role === 'admin' && courses.length > 0 ? (
                        courses.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                role={role}
                                teacherName={course.teacherId ? teacherNames[course.teacherId] : 'Unknown Teacher'}
                                isArchived={course.archived}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Image
                                source={require('../../assets/images/corner-splash-logo.png')}
                                style={styles.emptyStateLogo}
                                resizeMode="contain"
                            />
                            <Text style={styles.emptyStateText}>
                                {role === 'student' ? 'No courses enrolled yet' :
                                    role === 'teacher' ? 'Create your first course' :
                                        'No courses available'}
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyStateBtn}
                                onPress={() => router.push(role === 'student' ? '/join-course' : '/create-course')}
                            >
                                <Text style={styles.emptyStateBtnText}>
                                    {role === 'student' ? 'Join Course' : 'Create Course'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Feedback Section */}
                <View style={styles.feedbackSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Help Us Improve</Text>
                    </View>
                    <View style={styles.feedbackCards}>
                        <TouchableOpacity
                            style={styles.feedbackCard}
                            onPress={() => router.push('/feedback')}
                        >
                            <LinearGradient
                                colors={['#fbbf24', '#f59e0b']}
                                style={styles.feedbackCardGradient}
                            >
                                <Ionicons name="star" size={24} color="#fff" />
                                <Text style={styles.feedbackCardTitle}>Rate Corner</Text>
                                <Text style={styles.feedbackCardSubtitle}>Share your experience</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.feedbackCard}
                            onPress={() => router.push('/survey')}
                        >
                            <LinearGradient
                                colors={['#10b981', '#059669']}
                                style={styles.feedbackCardGradient}
                            >
                                <Ionicons name="clipboard" size={24} color="#fff" />
                                <Text style={styles.feedbackCardTitle}>Take Survey</Text>
                                <Text style={styles.feedbackCardSubtitle}>Help us improve</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* FAB */}
            {(role === 'teacher' || role === 'student') && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => router.push(role === 'student' ? '/join-course' : '/create-course')}
                >
                    <LinearGradient
                        colors={['#4f46e5', '#3730a3']}
                        style={styles.fabGradient}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

// New CourseCard Design
const CourseCard: React.FC<CourseCardProps> = ({
    course,
    role,
    teacherName,
    isArchived = false,
    actionIcon,
    actionColor,
    onAction,
    onActionMenu,
    children
}) => {
    return (
        <TouchableOpacity
            style={[styles.courseCard, isArchived && styles.archivedCard]}
            onPress={() => router.push({
                pathname: '/course-detail',
                params: {
                    courseId: course.id,
                    courseName: course.name,
                    courseCode: course.code || 'N/A',
                    instructorName: teacherName,
                    role: role,
                    isArchived: isArchived ? 'true' : 'false'
                }
            })}
        >
            <View style={styles.courseHeader}>
                <View style={styles.courseInfo}>
                    <Text style={[styles.courseName, isArchived && styles.archivedText]}>
                        {course.name}
                    </Text>
                    <Text style={styles.courseCode}>{course.code || 'No Code'}</Text>
                </View>

                {(actionIcon && onAction) && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={(e) => {
                            e.stopPropagation();
                            onAction();
                        }}
                    >
                        <Ionicons name={actionIcon} size={18} color={actionColor} />
                    </TouchableOpacity>
                )}

                {(actionIcon && onActionMenu) && (
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={(e) => {
                            e.stopPropagation();
                            onActionMenu();
                        }}
                    >
                        <Ionicons name={actionIcon} size={18} color={actionColor} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.courseDetails}>
                <View style={styles.detailRow}>
                    <Ionicons name="person" size={16} color="#4f46e5" />
                    <Text style={styles.detailText}>By {teacherName}</Text>
                </View>

                {course.createdAt && (
                    <View style={styles.detailRow}>
                        <Ionicons name="calendar" size={16} color="#764ba2" />
                        <Text style={styles.detailText}>
                            Created {new Date(course.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                )}

                {role === 'student' && course.joinedAt && (
                    <View style={styles.detailRow}>
                        <Ionicons name="log-in" size={16} color="#f093fb" />
                        <Text style={styles.detailText}>
                            Joined {new Date(course.joinedAt).toLocaleDateString()}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
    },
    loadingGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContent: {
        alignItems: 'center',
    },
    loadingIcon: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    loadingLogo: {
        width: 60,
        height: 60,
        borderRadius: 12,
    },
    loadingText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    welcomeGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    welcomeContent: {
        alignItems: 'center',
        maxWidth: 300,
    },
    welcomeIcon: {
        width: 120,
        height: 120,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    welcomeLogo: {
        width: 90,
        height: 90,
        borderRadius: 18,
    },
    welcomeTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    welcomeSubtitle: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24,
        fontWeight: '500',
    },
    welcomeButtons: {
        width: '100%',
        gap: 16,
    },
    primaryBtn: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryBtnText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryBtn: {
        backgroundColor: 'transparent',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    secondaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        paddingTop: 0,
        paddingBottom: 30,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 10,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4f46e5',
    },
    schoolName: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    greeting: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 2,
    },
    userName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    settingsBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    roleContainer: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    roleText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },
    scrollView: {
        flex: 1,
    },
    coursesSection: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 100,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a202c',
    },
    addCourseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    courseCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    archivedCard: {
        opacity: 0.6,
        backgroundColor: '#f7fafc',
    },
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    courseInfo: {
        flex: 1,
    },
    courseName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: 4,
    },
    archivedText: {
        color: '#718096',
    },
    courseCode: {
        fontSize: 14,
        color: '#4f46e5',
        fontWeight: '600',
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f7fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    courseDetails: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#4a5568',
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyStateLogo: {
        width: 80,
        height: 80,
        marginBottom: 16,
        opacity: 0.5,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#718096',
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
    },
    emptyStateBtn: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyStateBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    fabGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingIndicator: {
        marginVertical: 40,
    },
    feedbackSection: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 100,
    },
    feedbackCards: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    feedbackCard: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    feedbackCardGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    feedbackCardTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 10,
        textAlign: 'center',
    },
    feedbackCardSubtitle: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
});

