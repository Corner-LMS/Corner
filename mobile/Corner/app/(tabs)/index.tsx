import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert, Dimensions, StatusBar } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NotificationBadge from '../../components/NotificationBadge';
import { getSchoolById } from '@/constants/Schools';

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
    onViewStudents?: () => void;
    children?: React.ReactNode;
}

// Custom Action Menu Component
const ActionMenu = ({ visible, onClose, onArchive, onDelete, onManageStudents, courseName }: {
    visible: boolean;
    onClose: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onManageStudents: () => void;
    courseName: string;
}) => {
    if (!visible) return null;

    return (
        <View style={styles.actionMenuOverlay}>
            <TouchableOpacity style={styles.actionMenuBackdrop} onPress={onClose} />
            <View style={styles.actionMenu}>
                <View style={styles.actionMenuHeader}>
                    <Text style={styles.actionMenuTitle}>{courseName}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.actionMenuClose}>
                        <Ionicons name="close" size={20} color="#64748b" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.actionMenuItem} onPress={onManageStudents}>
                    <Ionicons name="people" size={20} color="#4f46e5" />
                    <Text style={styles.actionMenuText}>Manage Students</Text>
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e0" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionMenuItem} onPress={onArchive}>
                    <Ionicons name="archive" size={20} color="#f59e0b" />
                    <Text style={styles.actionMenuText}>Archive Course</Text>
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e0" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionMenuItem, styles.actionMenuItemDanger]} onPress={onDelete}>
                    <Ionicons name="trash" size={20} color="#ef4444" />
                    <Text style={[styles.actionMenuText, styles.actionMenuTextDanger]}>Delete Course</Text>
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e0" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default function DashboardScreen() {
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<any[]>([]);
    const [role, setRole] = useState('');
    const [studentCourses, setStudentCourses] = useState<any[]>([]);
    const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
    const [schoolInfo, setSchoolInfo] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);
    const [actionMenuVisible, setActionMenuVisible] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<any>(null);
    const insets = useSafeAreaInsets();

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

    const renderLogoSection = () => {
        return (
            <View style={styles.logoSection}>
                <View style={styles.logoIconContainer}>
                    <Text style={styles.logoIconText}>C</Text>
                </View>
            </View>
        );
    };

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
                            // Get student count for this course
                            const enrolledStudentsQuery = await firestore()
                                .collection('users')
                                .where('role', '==', 'student')
                                .where('courseIds', 'array-contains', courseId)
                                .get();

                            const studentCount = enrolledStudentsQuery.size;

                            studentCoursesList.push({
                                id: courseId,
                                ...courseData,
                                studentCount
                            });

                            // Get teacher name
                            if (courseData.teacherId) {
                                const teacherDoc = await firestore().collection('users').doc(courseData.teacherId).get();
                                if (teacherDoc.exists()) {
                                    const teacherData = teacherDoc.data();
                                    studentTeacherNamesMap[courseId] = teacherData?.name || 'Unknown Teacher';
                                }
                            }
                        }
                    }
                }

                setStudentCourses(studentCoursesList);
                setTeacherNames(studentTeacherNamesMap);
            } else if (userData.role === 'teacher') {
                // For teachers, fetch their created courses
                const teacherCoursesQuery = await firestore()
                    .collection('courses')
                    .where('teacherId', '==', user.uid)
                    .orderBy('createdAt', 'desc')
                    .get();

                coursesList = teacherCoursesQuery.docs.map(doc => {
                    const courseData = doc.data();
                    return {
                        id: doc.id,
                        ...courseData,
                        studentCount: 0 // Will be calculated separately
                    };
                });

                // Calculate student count for each course
                for (const course of coursesList) {
                    const enrolledStudentsQuery = await firestore()
                        .collection('users')
                        .where('role', '==', 'student')
                        .where('courseIds', 'array-contains', course.id)
                        .get();

                    course.studentCount = enrolledStudentsQuery.size;
                }

                setCourses(coursesList);
            } else if (userData.role === 'admin') {
                // For admins, fetch all courses in their school
                const adminCoursesQuery = await firestore()
                    .collection('courses')
                    .where('schoolId', '==', userData.schoolId)
                    .orderBy('createdAt', 'desc')
                    .get();

                coursesList = adminCoursesQuery.docs.map(doc => {
                    const courseData = doc.data();
                    return {
                        id: doc.id,
                        ...courseData,
                        studentCount: 0 // Will be calculated separately
                    };
                });

                // Calculate student count for each course
                for (const course of coursesList) {
                    const enrolledStudentsQuery = await firestore()
                        .collection('users')
                        .where('role', '==', 'student')
                        .where('courseIds', 'array-contains', course.id)
                        .get();

                    course.studentCount = enrolledStudentsQuery.size;
                }

                // Get teacher names for admin view
                const teacherIds = [...new Set(coursesList.map(course => course.teacherId).filter(Boolean))];
                const teacherPromises = teacherIds.map(async (teacherId) => {
                    const teacherDoc = await firestore().collection('users').doc(teacherId).get();
                    if (teacherDoc.exists()) {
                        const teacherData = teacherDoc.data();
                        return { [teacherId]: teacherData?.name || 'Unknown Teacher' };
                    }
                    return { [teacherId]: 'Unknown Teacher' };
                });

                const teacherResults = await Promise.all(teacherPromises);
                teacherNamesMap = teacherResults.reduce((acc, result) => ({ ...acc, ...result }), {});

                setCourses(coursesList);
                setTeacherNames(teacherNamesMap);
            }

            // Cache the results
            dashboardCache = {
                role: userData.role,
                userData,
                schoolInfo: getSchoolById(userData.schoolId),
                studentCourses: userData.role === 'student' ? (userData.role === 'student' ? studentCourses : []) : [],
                courses: coursesList,
                teacherNames: userData.role === 'student' ? (userData.role === 'student' ? teacherNames : {}) : teacherNamesMap
            };
            cacheTimestamp = now;

        } catch (error) {
            console.error('Error loading user and courses:', error);
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

    const handleActionMenu = useCallback((course: any) => {
        setSelectedCourse(course);
        setActionMenuVisible(true);
    }, []);

    const handleCloseActionMenu = useCallback(() => {
        setActionMenuVisible(false);
        setSelectedCourse(null);
    }, []);

    const handleManageStudents = () => {
        if (selectedCourse) {
            handleCloseActionMenu();
            router.push({
                pathname: '/manage-students',
                params: {
                    courseId: selectedCourse.id,
                    courseName: selectedCourse.name
                }
            });
        }
    };

    const handleViewStudents = (courseId: string, courseName: string) => {
        router.push({
            pathname: '/view-students',
            params: {
                courseId: courseId,
                courseName: courseName
            }
        });
    };

    const handleArchiveFromMenu = useCallback(() => {
        if (selectedCourse) {
            handleCloseActionMenu();
            Alert.alert(
                'Archive Course',
                `Are you sure you want to archive "${selectedCourse.name}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Archive',
                        onPress: async () => {
                            try {
                                await firestore().collection('courses').doc(selectedCourse.id).update({
                                    archived: true
                                });
                                setCourses(prev => prev.map(course =>
                                    course.id === selectedCourse.id
                                        ? { ...course, archived: true }
                                        : course
                                ));
                                Alert.alert('Success', `"${selectedCourse.name}" has been archived.`);
                            } catch (error) {
                                console.error('Error archiving course:', error);
                                Alert.alert('Error', 'Failed to archive course. Please try again.');
                            }
                        }
                    }
                ]
            );
        }
    }, [selectedCourse, handleCloseActionMenu]);

    const handleDeleteFromMenu = useCallback(() => {
        if (selectedCourse) {
            handleCloseActionMenu();
            Alert.alert(
                'Delete Course',
                `Are you sure you want to delete "${selectedCourse.name}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await firestore().collection('courses').doc(selectedCourse.id).delete();
                                setCourses(prev => prev.filter(course => course.id !== selectedCourse.id));
                                Alert.alert('Success', `"${selectedCourse.name}" has been deleted.`);
                            } catch (error) {
                                console.error('Error deleting course:', error);
                                Alert.alert('Error', 'Failed to delete course. Please try again.');
                            }
                        }
                    }
                ]
            );
        }
    }, [selectedCourse, handleCloseActionMenu]);

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.loadingGradient}
                >
                    <View style={styles.loadingContent}>
                        {renderLogoSection()}
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
                        {renderLogoSection()}
                        <View style={styles.welcomeTextSection}>
                            <Text style={styles.welcomeTitle}>Welcome to Corner</Text>
                            <Text style={styles.welcomeSubtitle}>
                                Your learning journey starts here
                            </Text>
                        </View>

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
                        <View style={styles.userDetails}>
                            <Text style={styles.schoolName}>{schoolInfo?.name || 'Your School'}</Text>
                            <Text style={styles.greeting}>Good {getTimeOfDay}</Text>
                            <Text style={styles.userName}>{getDisplayName(user, userData)}</Text>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.ratingBtn}
                            onPress={() => router.push({
                                pathname: '/support',
                                params: { scrollToFeedback: 'true' }
                            })}
                        >
                            <Ionicons name="star" size={18} color="#fbbf24" />
                        </TouchableOpacity>
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

            {/* Course List Container */}
            <View style={styles.courseListContainer}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
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
                                    onViewStudents={() => handleViewStudents(course.id, course.name)}
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
                                    onActionMenu={() => handleActionMenu(course)}
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
                                <View style={styles.emptyIcon}>
                                    <Ionicons name="book-outline" size={64} color="#cbd5e0" />
                                </View>
                                <Text style={styles.emptyTitle}>
                                    {role === 'student' ? 'No Courses Yet' :
                                        role === 'teacher' ? 'No Teaching Courses' : 'No School Courses'}
                                </Text>
                                <Text style={styles.emptySubtitle}>
                                    {role === 'student' ? 'Join your first course to get started' :
                                        role === 'teacher' ? 'Create your first course to begin teaching' :
                                            'No courses have been created yet'}
                                </Text>
                                {(role === 'teacher' || role === 'student') && (
                                    <TouchableOpacity
                                        style={styles.emptyActionBtn}
                                        onPress={() => router.push(role === 'student' ? '/join-course' : '/create-course')}
                                    >
                                        <Text style={styles.emptyActionBtnText}>
                                            {role === 'student' ? 'Join Course' : 'Create Course'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* FAB - Only show if not on inbox tab and user can create content */}
            {(role === 'teacher' || role === 'admin') ||
                (role === 'student') ? (
                <TouchableOpacity
                    style={[styles.fab, { bottom: Math.max(30, insets.bottom + 10) }]}
                    onPress={() => router.push(role === 'student' ? '/join-course' : '/create-course')}
                >
                    <LinearGradient
                        colors={['#4f46e5', '#3730a3']}
                        style={styles.fabGradient}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            ) : null}

            <ActionMenu
                visible={actionMenuVisible}
                onClose={handleCloseActionMenu}
                onArchive={handleArchiveFromMenu}
                onDelete={handleDeleteFromMenu}
                onManageStudents={handleManageStudents}
                courseName={selectedCourse?.name || ''}
            />
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
    onViewStudents,
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

                {course.studentCount !== undefined && (
                    <View style={styles.detailRow}>
                        <Ionicons name="people" size={16} color="#10b981" />
                        <Text style={styles.detailText}>
                            {course.studentCount} {course.studentCount === 1 ? 'student' : 'students'} enrolled
                        </Text>
                    </View>
                )}

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

            {/* View Students Button for Students */}
            {role === 'student' && onViewStudents && (
                <TouchableOpacity
                    style={styles.viewStudentsBtn}
                    onPress={(e) => {
                        e.stopPropagation();
                        onViewStudents();
                    }}
                >
                    <Ionicons name="people-outline" size={16} color="#4f46e5" />
                    <Text style={styles.viewStudentsText}>View Students</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#4f46e5',
    },
    loadingGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '600',
        marginTop: 16,
    },
    welcomeGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 100, // Extend to bottom tabs
    },
    welcomeContent: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    welcomeTextSection: {
        marginTop: 32,
        marginBottom: 32,
        alignItems: 'center',
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        marginTop: 24,
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    welcomeSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        lineHeight: 24,
    },
    welcomeButtons: {
        width: '100%',
        gap: 16,
    },
    primaryBtn: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    secondaryBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    secondaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    header: {
        height: 200, // Fixed height instead of padding
        paddingTop: 16,
        paddingBottom: 16, // Add bottom padding for spacing
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 16,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        marginRight: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        flexShrink: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarText: {
        color: '#4f46e5',
        fontSize: 18,
        fontWeight: '700',
    },
    userDetails: {
        flex: 1,
        minWidth: 0,
    },
    schoolName: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '500',
        marginBottom: 2,
    },
    greeting: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginBottom: 2,
    },
    userName: {
        fontSize: 18,
        color: '#fff',
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
    },
    ratingBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingsBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    roleContainer: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    roleText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    courseListContainer: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    coursesSection: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1e293b',
        letterSpacing: -0.3,
    },
    addCourseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4f46e5',
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
        paddingVertical: 40,
        paddingHorizontal: 24,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#718096',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    emptyActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4f46e5',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyActionBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 1000,
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
    actionMenuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    actionMenuBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    actionMenu: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '80%',
        maxWidth: 350,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    actionMenuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    actionMenuTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a202c',
    },
    actionMenuClose: {
        padding: 8,
    },
    actionMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f7fafc',
    },
    actionMenuItemDanger: {
        borderBottomColor: '#fef3f2',
    },
    actionMenuText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: '#4a5568',
        fontWeight: '500',
    },
    actionMenuTextDanger: {
        color: '#ef4444',
    },
    viewStudentsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f7fafc',
        borderRadius: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    viewStudentsText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#4f46e5',
        fontWeight: '600',
    },
    logoSection: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        backgroundColor: 'transparent',
    },
    logoIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#4f46e5',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 24,
    },
    logoIconText: {
        fontSize: 50,
        fontWeight: '800',
        color: '#ffffff',
        fontFamily: 'Georgia',
        letterSpacing: 4,
    },
});

