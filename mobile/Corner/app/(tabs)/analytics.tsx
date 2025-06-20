import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../config/ firebase-config';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, Timestamp } from 'firebase/firestore';
import { router } from 'expo-router';
import { getSchoolById } from '@/constants/Schools';
import { LinearGradient } from 'expo-linear-gradient';
import ConnectivityIndicator from '../../components/ConnectivityIndicator';

const { width: screenWidth } = Dimensions.get('window');

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
    schoolInfo?: {
        id: string;
        name: string;
        shortName: string;
    };
    // New analytics
    teacherParticipationRate: number;
    studentParticipationRate: number;
    weeklyActiveUsers: number;
    postsPerDay: { date: string; count: number }[];
    studentPostsPerDay: { date: string; count: number }[];
    teacherPostsPerDay: { date: string; count: number }[];
}

// Custom Chart Components
const CustomLineChart = ({ data, title }: { data: { date: string; count: number }[]; title: string }) => {
    const maxValue = Math.max(...data.map(item => item.count), 1);
    const chartHeight = 120;

    return (
        <View style={styles.customChart}>
            <Text style={styles.chartTitle}>{title}</Text>
            <View style={styles.chartContainer}>
                {data.map((item, index) => {
                    const height = (item.count / maxValue) * chartHeight;
                    const date = new Date(item.date);
                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });

                    return (
                        <View key={index} style={styles.chartBar}>
                            <View style={styles.barContainer}>
                                <View
                                    style={[
                                        styles.bar,
                                        {
                                            height: Math.max(height, 4),
                                            backgroundColor: '#4f46e5'
                                        }
                                    ]}
                                />
                            </View>
                            <Text style={styles.barLabel}>{dayLabel}</Text>
                            <Text style={styles.barValue}>{item.count}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const CustomBarChart = ({
    studentData,
    teacherData,
    title
}: {
    studentData: { date: string; count: number }[];
    teacherData: { date: string; count: number }[];
    title: string;
}) => {
    const maxValue = Math.max(
        ...studentData.map(item => item.count),
        ...teacherData.map(item => item.count),
        1
    );
    const chartHeight = 120;

    return (
        <View style={styles.customChart}>
            <Text style={styles.chartTitle}>{title}</Text>
            <View style={styles.chartContainer}>
                {studentData.map((item, index) => {
                    const studentHeight = (item.count / maxValue) * chartHeight;
                    const teacherHeight = (teacherData[index]?.count / maxValue) * chartHeight;
                    const date = new Date(item.date);
                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });

                    return (
                        <View key={index} style={styles.chartBar}>
                            <View style={styles.barContainer}>
                                <View
                                    style={[
                                        styles.bar,
                                        {
                                            height: Math.max(studentHeight, 2),
                                            backgroundColor: '#10b981',
                                            marginBottom: 2
                                        }
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.bar,
                                        {
                                            height: Math.max(teacherHeight, 2),
                                            backgroundColor: '#8b5cf6'
                                        }
                                    ]}
                                />
                            </View>
                            <Text style={styles.barLabel}>{dayLabel}</Text>
                            <Text style={styles.barValue}>{item.count + (teacherData[index]?.count || 0)}</Text>
                        </View>
                    );
                })}
            </View>
            <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                    <Text style={styles.legendText}>Students</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
                    <Text style={styles.legendText}>Teachers</Text>
                </View>
            </View>
        </View>
    );
};

export default function AnalyticsScreen() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Helper function to get date string for the last 7 days
    const getLast7Days = () => {
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
    };

    // Helper function to check if a timestamp is within last 7 days
    const isWithinLast7Days = (timestamp: any) => {
        if (!timestamp) return false;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const timestampDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return timestampDate >= sevenDaysAgo;
    };

    const fetchAnalyticsData = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            // Check if user is admin and get their school
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists() || userDoc.data().role !== 'admin') {
                Alert.alert('Access Denied', 'You do not have permission to view analytics.');
                router.back();
                return;
            }

            const adminData = userDoc.data();
            const adminSchoolId = adminData.schoolId;

            if (!adminSchoolId) {
                Alert.alert('Error', 'Your account is not associated with any school. Please contact support.');
                router.back();
                return;
            }

            // Get school information
            const schoolInfo = getSchoolById(adminSchoolId);
            if (!schoolInfo) {
                Alert.alert('Error', 'School information not found.');
                router.back();
                return;
            }

            // Fetch only courses from admin's school
            const coursesSnapshot = await getDocs(collection(db, 'courses'));
            const allCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const courses = allCourses.filter((course: any) => course.schoolId === adminSchoolId);

            // Fetch only users from admin's school
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const users = allUsers.filter((user: any) => user.schoolId === adminSchoolId);

            // Count users by role (only from admin's school)
            const roleCount = users.reduce((acc, user) => {
                const userData = user as any;
                acc[userData.role] = (acc[userData.role] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            // Fetch recent courses from admin's school (last 5)
            const recentCourses = courses
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5);

            // Count announcements and discussions across courses from admin's school only
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

            // Sort courses by activity (only from admin's school)
            const mostActiveCourses = courseActivity
                .sort((a, b) => b.totalActivity - a.totalActivity)
                .slice(0, 5);

            // NEW ANALYTICS: Calculate participation rates and activity data
            const last7Days = getLast7Days();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // Initialize daily post counters
            const postsPerDay = last7Days.map(date => ({ date, count: 0 }));
            const studentPostsPerDay = last7Days.map(date => ({ date, count: 0 }));
            const teacherPostsPerDay = last7Days.map(date => ({ date, count: 0 }));

            // Track active users and participation
            const activeUsers = new Set<string>();
            const activeTeachers = new Set<string>();
            const activeStudents = new Set<string>();

            // Collect all posts from the last 7 days
            for (const course of courses) {
                // Check announcements
                const announcementsSnapshot = await getDocs(
                    collection(db, 'courses', course.id, 'announcements')
                );

                for (const announcementDoc of announcementsSnapshot.docs) {
                    const announcementData = announcementDoc.data();
                    if (isWithinLast7Days(announcementData.createdAt)) {
                        const date = announcementData.createdAt.toDate().toISOString().split('T')[0];
                        const dayIndex = last7Days.indexOf(date);
                        if (dayIndex !== -1) {
                            postsPerDay[dayIndex].count++;
                            teacherPostsPerDay[dayIndex].count++;
                            activeUsers.add(announcementData.authorId);
                            activeTeachers.add(announcementData.authorId);
                        }
                    }
                }

                // Check discussions
                const discussionsSnapshot = await getDocs(
                    collection(db, 'courses', course.id, 'discussions')
                );

                for (const discussionDoc of discussionsSnapshot.docs) {
                    const discussionData = discussionDoc.data();
                    if (isWithinLast7Days(discussionData.createdAt)) {
                        const date = discussionData.createdAt.toDate().toISOString().split('T')[0];
                        const dayIndex = last7Days.indexOf(date);
                        if (dayIndex !== -1) {
                            postsPerDay[dayIndex].count++;
                            const authorUser = users.find(u => u.id === discussionData.authorId) as any;
                            const authorRole = authorUser?.role;
                            if (authorRole === 'student') {
                                studentPostsPerDay[dayIndex].count++;
                                activeStudents.add(discussionData.authorId);
                            } else if (authorRole === 'teacher') {
                                teacherPostsPerDay[dayIndex].count++;
                                activeTeachers.add(discussionData.authorId);
                            }
                            activeUsers.add(discussionData.authorId);
                        }
                    }

                    // Check comments in discussions
                    const commentsSnapshot = await getDocs(
                        collection(db, 'courses', course.id, 'discussions', discussionDoc.id, 'comments')
                    );

                    for (const commentDoc of commentsSnapshot.docs) {
                        const commentData = commentDoc.data();
                        if (isWithinLast7Days(commentData.createdAt)) {
                            const date = commentData.createdAt.toDate().toISOString().split('T')[0];
                            const dayIndex = last7Days.indexOf(date);
                            if (dayIndex !== -1) {
                                postsPerDay[dayIndex].count++;
                                const authorUser = users.find(u => u.id === commentData.authorId) as any;
                                const authorRole = authorUser?.role;
                                if (authorRole === 'student') {
                                    studentPostsPerDay[dayIndex].count++;
                                    activeStudents.add(commentData.authorId);
                                } else if (authorRole === 'teacher') {
                                    teacherPostsPerDay[dayIndex].count++;
                                    activeTeachers.add(commentData.authorId);
                                }
                                activeUsers.add(commentData.authorId);
                            }
                        }
                    }
                }
            }

            // Calculate participation rates
            const totalTeachers = roleCount.teacher || 0;
            const totalStudents = roleCount.student || 0;
            const teacherParticipationRate = totalTeachers > 0 ? Math.round((activeTeachers.size / totalTeachers) * 100) : 0;
            const studentParticipationRate = totalStudents > 0 ? Math.round((activeStudents.size / totalStudents) * 100) : 0;

            setAnalytics({
                totalCourses: courses.length,
                totalUsers: users.length,
                totalStudents: roleCount.student || 0,
                totalTeachers: roleCount.teacher || 0,
                totalAdmins: roleCount.admin || 0,
                totalAnnouncements,
                totalDiscussions,
                recentCourses,
                mostActiveCourses,
                schoolInfo: {
                    id: schoolInfo.id,
                    name: schoolInfo.name,
                    shortName: schoolInfo.shortName
                },
                // New analytics
                teacherParticipationRate,
                studentParticipationRate,
                weeklyActiveUsers: activeUsers.size,
                postsPerDay,
                studentPostsPerDay,
                teacherPostsPerDay,
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
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.loadingGradient}
                >
                    <View style={styles.loadingContent}>
                        <View style={styles.loadingIcon}>
                            <Ionicons name="analytics" size={40} color="#fff" />
                        </View>
                        <Text style={styles.loadingText}>Loading analytics...</Text>
                    </View>
                </LinearGradient>
            </SafeAreaView>
        );
    }

    if (!analytics) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.header}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Analytics</Text>
                        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
                            <Ionicons
                                name="refresh"
                                size={24}
                                color={refreshing ? "#cbd5e1" : "#fff"}
                            />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
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
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />

            {/* Header */}
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
                        {analytics?.schoolInfo && (
                            <Text style={styles.schoolName}>{analytics.schoolInfo.name}</Text>
                        )}
                    </View>
                    <View style={styles.headerActions}>
                        <ConnectivityIndicator size="small" showText={false} />
                        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
                            <Ionicons
                                name="refresh"
                                size={24}
                                color={refreshing ? "#cbd5e1" : "#fff"}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Key Metrics Cards */}
                <View style={styles.metricsSection}>
                    <View style={styles.metricRow}>
                        <View style={[styles.metricCard, styles.primaryMetric]}>
                            <LinearGradient
                                colors={['#4f46e5', '#3730a3']}
                                style={styles.metricGradient}
                            >
                                <Ionicons name="school" size={24} color="#fff" />
                                <Text style={styles.metricNumber}>{analytics.totalCourses}</Text>
                                <Text style={styles.metricLabel}>Total Courses</Text>
                            </LinearGradient>
                        </View>
                        <View style={[styles.metricCard, styles.secondaryMetric]}>
                            <LinearGradient
                                colors={['#06b6d4', '#0891b2']}
                                style={styles.metricGradient}
                            >
                                <Ionicons name="people" size={24} color="#fff" />
                                <Text style={styles.metricNumber}>{analytics.totalUsers}</Text>
                                <Text style={styles.metricLabel}>Total Users</Text>
                            </LinearGradient>
                        </View>
                    </View>
                </View>

                {/* User Distribution */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>User Distribution</Text>
                    <View style={styles.distributionGrid}>
                        <View style={styles.distributionCard}>
                            <View style={styles.distributionIcon}>
                                <Ionicons name="person" size={20} color="#10b981" />
                            </View>
                            <Text style={styles.distributionNumber}>{analytics.totalStudents}</Text>
                            <Text style={styles.distributionLabel}>Students</Text>
                        </View>
                        <View style={styles.distributionCard}>
                            <View style={styles.distributionIcon}>
                                <Ionicons name="desktop" size={20} color="#8b5cf6" />
                            </View>
                            <Text style={styles.distributionNumber}>{analytics.totalTeachers}</Text>
                            <Text style={styles.distributionLabel}>Teachers</Text>
                        </View>
                        <View style={styles.distributionCard}>
                            <View style={styles.distributionIcon}>
                                <Ionicons name="shield-checkmark" size={20} color="#f59e0b" />
                            </View>
                            <Text style={styles.distributionNumber}>{analytics.totalAdmins}</Text>
                            <Text style={styles.distributionLabel}>Admins</Text>
                        </View>
                    </View>
                </View>

                {/* Activity Overview */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity Overview</Text>
                    <View style={styles.activityCard}>
                        <View style={styles.activityItem}>
                            <View style={styles.activityIcon}>
                                <Ionicons name="megaphone" size={24} color="#ef4444" />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={styles.activityNumber}>{analytics.totalAnnouncements}</Text>
                                <Text style={styles.activityLabel}>Announcements</Text>
                            </View>
                        </View>
                        <View style={styles.activityDivider} />
                        <View style={styles.activityItem}>
                            <View style={styles.activityIcon}>
                                <Ionicons name="chatbubbles" size={24} color="#06b6d4" />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={styles.activityNumber}>{analytics.totalDiscussions}</Text>
                                <Text style={styles.activityLabel}>Discussions</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Participation Rates */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Participation Rates</Text>
                    <Text style={styles.sectionSubtitle}>Last 7 days</Text>
                    <View style={styles.participationGrid}>
                        <View style={styles.participationCard}>
                            <View style={styles.participationIcon}>
                                <Ionicons name="desktop" size={24} color="#8b5cf6" />
                            </View>
                            <Text style={styles.participationRate}>{analytics.teacherParticipationRate}%</Text>
                            <Text style={styles.participationLabel}>Teachers Active</Text>
                            <Text style={styles.participationSubtext}>
                                {analytics.totalTeachers} total teachers
                            </Text>
                        </View>
                        <View style={styles.participationCard}>
                            <View style={styles.participationIcon}>
                                <Ionicons name="person" size={24} color="#10b981" />
                            </View>
                            <Text style={styles.participationRate}>{analytics.studentParticipationRate}%</Text>
                            <Text style={styles.participationLabel}>Students Active</Text>
                            <Text style={styles.participationSubtext}>
                                {analytics.totalStudents} total students
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Weekly Active Users */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Weekly Active Users</Text>
                    <Text style={styles.sectionSubtitle}>Last 7 days</Text>
                    <View style={styles.wauCard}>
                        <View style={styles.wauContent}>
                            <View style={styles.wauIcon}>
                                <Ionicons name="people" size={24} color="#06b6d4" />
                            </View>
                            <View style={styles.wauInfo}>
                                <Text style={styles.wauNumber}>{analytics.weeklyActiveUsers}</Text>
                                <Text style={styles.wauLabel}>Active Users</Text>
                                <Text style={styles.wauSubtext}>
                                    {Math.round((analytics.weeklyActiveUsers / analytics.totalUsers) * 100)}% of total users
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Daily Post Trends */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Daily Post Trends</Text>
                    <Text style={styles.sectionSubtitle}>Last 7 days</Text>
                    <View style={styles.chartCard}>
                        <CustomLineChart data={analytics.postsPerDay} title="Total Posts Per Day" />
                    </View>
                </View>

                {/* Student vs Teacher Posts */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Student vs Teacher Posts</Text>
                    <Text style={styles.sectionSubtitle}>Last 7 days</Text>
                    <View style={styles.chartCard}>
                        <CustomBarChart studentData={analytics.studentPostsPerDay} teacherData={analytics.teacherPostsPerDay} title="Student vs Teacher Posts" />
                    </View>
                </View>

                {/* Most Active Courses */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Most Active Courses</Text>
                        <Text style={styles.sectionSubtitle}>By engagement</Text>
                    </View>
                    <View style={styles.coursesList}>
                        {analytics.mostActiveCourses.map((course, index) => (
                            <TouchableOpacity
                                key={course.id}
                                style={styles.courseCard}
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
                                <View style={styles.courseRank}>
                                    <Text style={styles.rankText}>#{index + 1}</Text>
                                </View>
                                <View style={styles.courseInfo}>
                                    <Text style={styles.courseName}>{course.name}</Text>
                                    <Text style={styles.courseStats}>
                                        {course.announcements} announcements • {course.discussions} discussions
                                    </Text>
                                </View>
                                <View style={styles.courseActivity}>
                                    <Text style={styles.activityScore}>{course.totalActivity}</Text>
                                    <Text style={styles.activityLabel}>points</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Recent Courses */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recently Created</Text>
                        <Text style={styles.sectionSubtitle}>Latest additions</Text>
                    </View>
                    <View style={styles.recentList}>
                        {analytics.recentCourses.map((course) => (
                            <TouchableOpacity
                                key={course.id}
                                style={styles.recentCard}
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
                                <View style={styles.recentIcon}>
                                    <Ionicons name="book" size={20} color="#4f46e5" />
                                </View>
                                <View style={styles.recentContent}>
                                    <Text style={styles.recentTitle}>{course.name}</Text>
                                    <Text style={styles.recentDate}>
                                        Created {new Date(course.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
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
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    loadingText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    header: {
        paddingTop: 0,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    schoolName: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    refreshButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    metricsSection: {
        marginBottom: 32,
    },
    metricRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metricCard: {
        flex: 1,
        height: 120,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    metricGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    metricNumber: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        marginTop: 8,
    },
    metricLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 4,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    distributionGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    distributionCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    distributionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    distributionNumber: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a202c',
        marginBottom: 4,
    },
    distributionLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
        textAlign: 'center',
    },
    activityCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    activityIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    activityContent: {
        flex: 1,
    },
    activityNumber: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a202c',
        marginBottom: 4,
    },
    activityLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    activityDivider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 20,
    },
    coursesList: {
        gap: 12,
    },
    courseCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    courseRank: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    rankText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    courseInfo: {
        flex: 1,
    },
    courseName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: 4,
    },
    courseStats: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    courseActivity: {
        backgroundColor: '#4f46e5',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
    },
    activityScore: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
    },
    recentList: {
        gap: 12,
    },
    recentCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    recentIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    recentContent: {
        flex: 1,
    },
    recentTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: 4,
    },
    recentDate: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        marginBottom: 24,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    primaryMetric: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    secondaryMetric: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    participationGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    participationCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    participationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    participationRate: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a202c',
        marginBottom: 4,
    },
    participationLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
        textAlign: 'center',
    },
    participationSubtext: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
        textAlign: 'center',
    },
    wauCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    wauContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    wauIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    wauInfo: {
        flex: 1,
    },
    wauNumber: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a202c',
        marginBottom: 4,
    },
    wauLabel: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 4,
    },
    wauSubtext: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
    },
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    customChart: {
        width: '100%',
    },
    chartContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 140,
        paddingHorizontal: 10,
        marginTop: 16,
    },
    chartBar: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 2,
    },
    barContainer: {
        width: '80%',
        height: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    bar: {
        width: '100%',
        borderRadius: 4,
        minHeight: 4,
    },
    barLabel: {
        marginTop: 8,
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        textAlign: 'center',
    },
    barValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1a202c',
        marginTop: 2,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a202c',
        textAlign: 'center',
        marginBottom: 8,
    },
    chartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        gap: 24,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    legendText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
}); 