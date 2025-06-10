import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../config/ firebase-config';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { router } from 'expo-router';

interface AnalyticsData {
    totalCourses: number;
    totalUsers: number;
    totalStudents: number;
    totalTeachers: number;
    totalAdmins: number;
    totalAnnouncements: number;
    totalDiscussions: number;
    recentCourses: any[];
    mostActiveCourses: any[];
}

export default function AnalyticsScreen() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAnalyticsData = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            // Check if user is admin
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists() || userDoc.data().role !== 'admin') {
                Alert.alert('Access Denied', 'You do not have permission to view analytics.');
                router.back();
                return;
            }

            // Fetch all courses
            const coursesSnapshot = await getDocs(collection(db, 'courses'));
            const courses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Fetch all users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Count users by role
            const roleCount = users.reduce((acc, user) => {
                const userData = user as any; // Type assertion for Firebase data
                acc[userData.role] = (acc[userData.role] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            // Fetch recent courses (last 5)
            const recentCoursesQuery = query(
                collection(db, 'courses'),
                orderBy('createdAt', 'desc'),
                limit(5)
            );
            const recentCoursesSnapshot = await getDocs(recentCoursesQuery);
            const recentCourses = recentCoursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Count announcements and discussions across all courses
            let totalAnnouncements = 0;
            let totalDiscussions = 0;
            const courseActivity = [];

            for (const course of courses) {
                const announcementsSnapshot = await getDocs(
                    collection(db, 'courses', course.id, 'announcements')
                );
                const discussionsSnapshot = await getDocs(
                    collection(db, 'courses', course.id, 'discussions')
                );

                const announcementCount = announcementsSnapshot.size;
                const discussionCount = discussionsSnapshot.size;

                totalAnnouncements += announcementCount;
                totalDiscussions += discussionCount;

                courseActivity.push({
                    ...course,
                    announcements: announcementCount,
                    discussions: discussionCount,
                    totalActivity: announcementCount + discussionCount
                });
            }

            // Sort courses by activity
            const mostActiveCourses = courseActivity
                .sort((a, b) => b.totalActivity - a.totalActivity)
                .slice(0, 5);

            setAnalytics({
                totalCourses: courses.length,
                totalUsers: users.length,
                totalStudents: roleCount.student || 0,
                totalTeachers: roleCount.teacher || 0,
                totalAdmins: roleCount.admin || 0,
                totalAnnouncements,
                totalDiscussions,
                recentCourses,
                mostActiveCourses
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
            Alert.alert('Error', 'Failed to load analytics data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAnalyticsData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAnalyticsData();
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#81171b" />
                    <Text style={styles.loadingText}>Loading analytics...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!analytics) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#ff3b30" />
                    <Text style={styles.errorText}>Failed to load analytics</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchAnalyticsData}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Platform Analytics</Text>
                <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
                    <Ionicons
                        name="refresh"
                        size={24}
                        color={refreshing ? "#999" : "#81171b"}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Overview Cards */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Overview</Text>
                    <View style={styles.cardGrid}>
                        <View style={[styles.card, styles.primaryCard]}>
                            <Ionicons name="book-outline" size={32} color="#81171b" />
                            <Text style={styles.cardNumber}>{analytics.totalCourses}</Text>
                            <Text style={styles.cardLabel}>Total Courses</Text>
                        </View>
                        <View style={[styles.card, styles.secondaryCard]}>
                            <Ionicons name="people-outline" size={32} color="#2563eb" />
                            <Text style={styles.cardNumber}>{analytics.totalUsers}</Text>
                            <Text style={styles.cardLabel}>Total Users</Text>
                        </View>
                    </View>
                </View>

                {/* User Breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>User Distribution</Text>
                    <View style={styles.cardGrid}>
                        <View style={styles.card}>
                            <Ionicons name="book-outline" size={24} color="#10b981" />
                            <Text style={styles.cardNumber}>{analytics.totalStudents}</Text>
                            <Text style={styles.cardLabel}>Students</Text>
                        </View>
                        <View style={styles.card}>
                            <Ionicons name="desktop-outline" size={24} color="#8b5cf6" />
                            <Text style={styles.cardNumber}>{analytics.totalTeachers}</Text>
                            <Text style={styles.cardLabel}>Teachers</Text>
                        </View>
                        <View style={styles.card}>
                            <Ionicons name="shield-checkmark-outline" size={24} color="#f59e0b" />
                            <Text style={styles.cardNumber}>{analytics.totalAdmins}</Text>
                            <Text style={styles.cardLabel}>Admins</Text>
                        </View>
                    </View>
                </View>

                {/* Activity Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Platform Activity</Text>
                    <View style={styles.cardGrid}>
                        <View style={[styles.card, styles.fullWidth]}>
                            <View style={styles.activityRow}>
                                <View style={styles.activityItem}>
                                    <Ionicons name="megaphone-outline" size={24} color="#ef4444" />
                                    <Text style={styles.cardNumber}>{analytics.totalAnnouncements}</Text>
                                    <Text style={styles.cardLabel}>Announcements</Text>
                                </View>
                                <View style={styles.activityItem}>
                                    <Ionicons name="chatbubbles-outline" size={24} color="#06b6d4" />
                                    <Text style={styles.cardNumber}>{analytics.totalDiscussions}</Text>
                                    <Text style={styles.cardLabel}>Discussions</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Most Active Courses */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Most Active Courses</Text>
                    <View style={styles.listContainer}>
                        {analytics.mostActiveCourses.map((course, index) => (
                            <TouchableOpacity
                                key={course.id}
                                style={styles.listItem}
                                onPress={() => router.push({
                                    pathname: '/course-detail',
                                    params: {
                                        courseId: course.id,
                                        courseName: course.name,
                                        courseCode: course.code || 'N/A',
                                        instructorName: 'Unknown',
                                        role: 'admin'
                                    }
                                })}
                            >
                                <View style={styles.listItemContent}>
                                    <Text style={styles.listItemTitle}>{course.name}</Text>
                                    <Text style={styles.listItemSubtitle}>
                                        {course.announcements} announcements • {course.discussions} discussions
                                    </Text>
                                </View>
                                <View style={styles.activityBadge}>
                                    <Text style={styles.activityBadgeText}>{course.totalActivity}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Recent Courses */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recently Created Courses</Text>
                    <View style={styles.listContainer}>
                        {analytics.recentCourses.map((course) => (
                            <TouchableOpacity
                                key={course.id}
                                style={styles.listItem}
                                onPress={() => router.push({
                                    pathname: '/course-detail',
                                    params: {
                                        courseId: course.id,
                                        courseName: course.name,
                                        courseCode: course.code || 'N/A',
                                        instructorName: 'Unknown',
                                        role: 'admin'
                                    }
                                })}
                            >
                                <View style={styles.listItemContent}>
                                    <Text style={styles.listItemTitle}>{course.name}</Text>
                                    <Text style={styles.listItemSubtitle}>
                                        {course.description || 'No description'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1f2937',
    },
    refreshButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 16,
    },
    cardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        flex: 1,
        minWidth: '45%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    primaryCard: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    secondaryCard: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    fullWidth: {
        minWidth: '100%',
    },
    cardNumber: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1f2937',
        marginTop: 8,
    },
    cardLabel: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 4,
    },
    activityRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    activityItem: {
        alignItems: 'center',
    },
    listContainer: {
        gap: 8,
    },
    listItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    listItemContent: {
        flex: 1,
    },
    listItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    listItemSubtitle: {
        fontSize: 14,
        color: '#6b7280',
    },
    activityBadge: {
        backgroundColor: '#81171b',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    activityBadgeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: '#374151',
        marginTop: 16,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#81171b',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
}); 