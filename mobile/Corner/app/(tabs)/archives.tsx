import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/ firebase-config';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color="#81171b" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Ionicons name="archive-outline" size={32} color="#81171b" />
                        <Text style={styles.title}>Archives</Text>
                    </View>

                    <Text style={styles.subtitle}>
                        {role === 'student' ? 'Courses you have left' : 'Your archived courses'}
                    </Text>

                    {archivedCourses.length > 0 ? (
                        archivedCourses.map((course) => (
                            <View key={course.id} style={styles.courseContainer}>
                                <TouchableOpacity
                                    style={styles.courseBox}
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
                                            <Ionicons name="archive" size={20} color="#fff" />
                                        </View>
                                    </View>

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
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.unarchiveButton}
                                    onPress={() => handleUnarchiveCourse(course.id, course.name)}
                                >
                                    <Ionicons name={role === 'student' ? 'enter-outline' : 'refresh-outline'} size={16} color="#81171b" />
                                    <Text style={styles.unarchiveButtonText}>
                                        {role === 'student' ? 'Rejoin Course' : 'Unarchive'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="archive-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyTitle}>No archived courses</Text>
                            <Text style={styles.emptyText}>
                                {role === 'student'
                                    ? "Courses you leave will appear here"
                                    : "Courses you archive will appear here"
                                }
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginLeft: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
    },
    courseContainer: {
        marginBottom: 30,
    },
    courseBox: {
        backgroundColor: '#f8f8f8',
        padding: 20,
        borderRadius: 12,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#ccc',
    },
    courseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    courseName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    archivedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#81171b',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    courseDetail: {
        marginBottom: 10,
    },
    courseLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    courseValue: {
        fontSize: 16,
        color: '#333',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#666',
        marginTop: 20,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        lineHeight: 22,
    },
    unarchiveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#81171b',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    unarchiveButtonText: {
        color: '#81171b',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
}); 