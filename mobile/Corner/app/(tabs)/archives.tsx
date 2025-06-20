import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/ firebase-config';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ConnectivityIndicator from '../../components/ConnectivityIndicator';
import { LinearGradient } from 'expo-linear-gradient';

export default function ArchivesScreen() {
    const [loading, setLoading] = useState(true);
    const [archivedCourses, setArchivedCourses] = useState<any[]>([]);
    const [role, setRole] = useState('');

    const fetchArchivedCourses = async (user: any, userData: any) => {
        try {
            if (userData.role === 'student' && userData.archivedCourseIds && userData.archivedCourseIds.length > 0) {
                const coursesList = [];

                for (const courseId of userData.archivedCourseIds) {
                    const courseRef = doc(db, 'courses', courseId);
                    const courseSnap = await getDoc(courseRef);
                    if (courseSnap.exists()) {
                        const courseData = courseSnap.data();
                        coursesList.push({
                            ...courseData,
                            id: courseId,
                            archivedAt: userData.courseArchiveDates?.[courseId] || new Date().toISOString()
                        });
                    }
                }
                setArchivedCourses(coursesList);
            }

            if (userData.role === 'teacher') {
                // Get all courses by this teacher
                const allCoursesQuery = query(
                    collection(db, 'courses'),
                    where('teacherId', '==', user.uid)
                );
                const snapshot = await getDocs(allCoursesQuery);

                // Filter for archived courses
                const coursesList = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter((course: any) => course.archived === true);

                setArchivedCourses(coursesList);
            }
        } catch (error) {
            console.error('Error fetching archived courses:', error);
        }
    };

    const loadUserAndCourses = async () => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            router.replace('/welcome');
            return;
        }

        // Get user role from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setRole(userData.role);
            await fetchArchivedCourses(user, userData);
        }

        setLoading(false);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false);
                router.replace('/welcome');
                return;
            }
            await loadUserAndCourses();
        });

        return () => unsubscribe();
    }, []);

    // Refresh data when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            if (auth.currentUser) {
                loadUserAndCourses();
            }
        }, [])
    );

    const handleUnarchiveCourse = async (courseId: string, courseName: string) => {
        if (role === 'student') {
            // Student rejoining course
            Alert.alert(
                'Rejoin Course',
                `Do you want to rejoin "${courseName}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Rejoin',
                        onPress: async () => {
                            try {
                                const user = auth.currentUser;
                                if (!user) return;

                                const userRef = doc(db, 'users', user.uid);
                                const userSnap = await getDoc(userRef);

                                if (userSnap.exists()) {
                                    const userData = userSnap.data();
                                    const courseIds = userData.courseIds || [];
                                    const archivedCourseIds = userData.archivedCourseIds || [];
                                    const courseJoinDates = userData.courseJoinDates || {};
                                    const courseArchiveDates = userData.courseArchiveDates || {};

                                    // Remove from archived and add back to active
                                    const updatedArchivedIds = archivedCourseIds.filter((id: string) => id !== courseId);
                                    courseIds.push(courseId);
                                    courseJoinDates[courseId] = new Date().toISOString();
                                    delete courseArchiveDates[courseId];

                                    await updateDoc(userRef, {
                                        courseIds: courseIds,
                                        archivedCourseIds: updatedArchivedIds,
                                        courseJoinDates: courseJoinDates,
                                        courseArchiveDates: courseArchiveDates
                                    });

                                    // Update local state
                                    setArchivedCourses(prev => prev.filter(course => course.id !== courseId));

                                    Alert.alert('Success', `You have rejoined "${courseName}".`);
                                }
                            } catch (error) {
                                console.error('Error rejoining course:', error);
                                Alert.alert('Error', 'Failed to rejoin course. Please try again.');
                            }
                        }
                    }
                ]
            );
        } else {
            // Teacher unarchiving course
            Alert.alert(
                'Unarchive Course',
                `Do you want to unarchive "${courseName}" and make it active again?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Unarchive',
                        onPress: async () => {
                            try {
                                // Remove archived status from course
                                await updateDoc(doc(db, 'courses', courseId), {
                                    archived: deleteField(),
                                    archivedAt: deleteField()
                                });

                                // Update local state
                                setArchivedCourses(prev => prev.filter(course => course.id !== courseId));

                                Alert.alert('Success', `"${courseName}" has been unarchived and is now active.`);
                            } catch (error) {
                                console.error('Error unarchiving course:', error);
                                Alert.alert('Error', 'Failed to unarchive course. Please try again.');
                            }
                        }
                    }
                ]
            );
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown date';
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.header}
                >
                    <View style={{ width: 24 }} />
                    <Text style={styles.title}>Archives</Text>
                    <ConnectivityIndicator size="small" style={styles.connectivityIndicator} />
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4f46e5" />
                    <Text style={styles.loadingText}>Loading archives...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <View style={{ width: 24 }} />
                <Text style={styles.title}>Archives</Text>
                <ConnectivityIndicator size="small" style={styles.connectivityIndicator} />
            </LinearGradient>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.subtitle}>
                    {role === 'student' ? 'Courses you have left' : 'Your archived courses'}
                </Text>

                {archivedCourses.length > 0 ? (
                    archivedCourses.map((course) => (
                        <View key={course.id} style={styles.courseContainer}>
                            <TouchableOpacity
                                style={styles.courseCard}
                                onPress={() => router.push({
                                    pathname: '/course-detail',
                                    params: {
                                        courseId: course.id,
                                        courseName: course.name,
                                        courseCode: course.code,
                                        instructorName: course.instructorName,
                                        role: role,
                                        isArchived: 'true'
                                    }
                                })}
                            >
                                <View style={styles.courseHeader}>
                                    <Text style={styles.courseName}>{course.name}</Text>
                                    <View style={styles.archivedBadge}>
                                        <Ionicons name="archive" size={16} color="#fff" />
                                    </View>
                                </View>

                                <View style={styles.courseDetails}>
                                    <View style={styles.courseDetail}>
                                        <Text style={styles.courseLabel}>Course Code:</Text>
                                        <Text style={styles.courseValue}>{course.code}</Text>
                                    </View>

                                    <View style={styles.courseDetail}>
                                        <Text style={styles.courseLabel}>Instructor:</Text>
                                        <Text style={styles.courseValue}>{course.instructorName}</Text>
                                    </View>

                                    {role === 'student' ? (
                                        <View style={styles.courseDetail}>
                                            <Text style={styles.courseLabel}>Left on:</Text>
                                            <Text style={styles.courseValue}>{formatDate(course.archivedAt)}</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.courseDetail}>
                                            <Text style={styles.courseLabel}>Archived on:</Text>
                                            <Text style={styles.courseValue}>{formatDate(course.archivedAt)}</Text>
                                        </View>
                                    )}

                                    <View style={styles.courseDetail}>
                                        <Text style={styles.courseLabel}>Originally created:</Text>
                                        <Text style={styles.courseValue}>{formatDate(course.createdAt)}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.unarchiveButton}
                                onPress={() => handleUnarchiveCourse(course.id, course.name)}
                            >
                                <Ionicons
                                    name={role === 'student' ? 'enter-outline' : 'refresh-outline'}
                                    size={16}
                                    color="#4f46e5"
                                />
                                <Text style={styles.unarchiveButtonText}>
                                    {role === 'student' ? 'Rejoin Course' : 'Unarchive'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="archive-outline" size={64} color="#94a3b8" />
                        </View>
                        <Text style={styles.emptyTitle}>No archived courses</Text>
                        <Text style={styles.emptyText}>
                            {role === 'student'
                                ? "Courses you leave will appear here"
                                : "Courses you archive will appear here"
                            }
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingTop: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    connectivityIndicator: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 120,
    },
    loadingText: {
        fontSize: 16,
        color: '#64748b',
        marginTop: 12,
        fontWeight: '500',
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        marginBottom: 24,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    courseContainer: {
        marginBottom: 20,
    },
    courseCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    courseName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        letterSpacing: -0.3,
    },
    archivedBadge: {
        backgroundColor: '#64748b',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    courseDetails: {
        gap: 12,
    },
    courseDetail: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    courseLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        letterSpacing: 0.2,
    },
    courseValue: {
        fontSize: 14,
        color: '#1e293b',
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    unarchiveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#4f46e5',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 16,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    unarchiveButtonText: {
        color: '#4f46e5',
        fontSize: 15,
        fontWeight: '700',
        marginLeft: 8,
        letterSpacing: 0.3,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyIcon: {
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        borderRadius: 50,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.2)',
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    emptyText: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
}); 