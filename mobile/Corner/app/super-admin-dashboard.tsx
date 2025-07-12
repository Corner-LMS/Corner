import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { getSchoolById } from '../constants/Schools';

interface Feedback {
    id: string;
    rating: number;
    comment: string;
    email: string;
    userEmail: string;
    createdAt: any;
}

interface Survey {
    id: string;
    answers: { [key: string]: string | string[] };
    suggestion: string;
    userEmail: string;
    createdAt: any;
}

interface Analytics {
    totalFeedback: number;
    totalSurveys: number;
    averageRating: number;
    ratingDistribution: { [key: number]: number };
    featureUsage: { [key: string]: number };
    satisfactionDistribution: { [key: string]: number };
    schools: { [key: string]: { name: string; userCount: number; roles: { [key: string]: number } } };
}

export default function SuperAdminDashboardScreen() {
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'feedback' | 'surveys'>('overview');

    useEffect(() => {
        checkSuperAdminAccess();
    }, []);

    const checkSuperAdminAccess = async () => {
        const user = auth().currentUser;
        if (!user) {
            Alert.alert('Access Denied', 'You must be logged in to access this page.');
            router.replace('/(auth)/login');
            return;
        }

        // Check if user is superadmin
        let isSuperAdmin = false;

        try {
            const userDoc = await firestore().collection('users').doc(user.uid).get();

            if (userDoc.exists()) {
                const userData = userDoc.data();
                isSuperAdmin = userData?.role === 'superadmin' || userData?.isSuperAdmin === true;
            }

            // If user document doesn't exist but email matches, create it
            if (!userDoc.exists() && user.email === 'corner.e.learning@gmail.com') {
                await firestore().collection('users').doc(user.uid).set({
                    email: 'corner.e.learning@gmail.com',
                    role: 'superadmin',
                    name: 'Super Admin',
                    createdAt: new Date(),
                    isSuperAdmin: true
                });
                isSuperAdmin = true;
            }
        } catch (error) {
            console.error('Error checking super admin access:', error);
        }

        // Also check for hardcoded email as fallback
        if (!isSuperAdmin && user.email !== 'corner.e.learning@gmail.com') {
            Alert.alert('Access Denied', 'Only superadmin can access this dashboard.');
            router.replace('/(auth)/login');
            return;
        }

        loadData();
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                loadFeedback(),
                loadSurveys(),
                loadSchools()
            ]);
            // Calculate analytics after data is loaded
            calculateAnalytics();
        } catch (error) {
            console.error('Error loading admin data:', error);
            Alert.alert('Error', 'Failed to load dashboard data.');
        } finally {
            setIsLoading(false);
        }
    };

    const loadFeedback = async () => {
        const feedbackSnapshot = await firestore()
            .collection('feedback')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const feedbackData = feedbackSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Feedback[];

        setFeedback(feedbackData);
    };

    const loadSurveys = async () => {
        const surveysSnapshot = await firestore()
            .collection('surveys')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        const surveysData = surveysSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Survey[];

        setSurveys(surveysData);
    };

    const loadSchools = async () => {
        try {
            const usersSnapshot = await firestore()
                .collection('users')
                .get();

            const schools: { [key: string]: { name: string; userCount: number; roles: { [key: string]: number } } } = {};
            let totalUsers = 0;
            let usersWithSchoolId = 0;

            usersSnapshot.docs.forEach(doc => {
                const userData = doc.data();
                totalUsers++;

                const schoolId = userData.schoolId;
                const role = userData.role;

                if (schoolId) {
                    usersWithSchoolId++;
                }

                if (schoolId && role && role !== 'superadmin') {
                    if (!schools[schoolId]) {
                        // Get school code from constants
                        const schoolInfo = getSchoolById(schoolId);
                        schools[schoolId] = {
                            name: schoolInfo?.code || schoolInfo?.shortName || `School ${schoolId}`,
                            userCount: 0,
                            roles: {}
                        };
                    }
                    schools[schoolId].userCount++;
                    schools[schoolId].roles[role] = (schools[schoolId].roles[role] || 0) + 1;
                }
            });

            // Update analytics with schools data
            setAnalytics(prev => ({
                totalFeedback: prev?.totalFeedback || 0,
                totalSurveys: prev?.totalSurveys || 0,
                averageRating: prev?.averageRating || 0,
                ratingDistribution: prev?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                featureUsage: prev?.featureUsage || {},
                satisfactionDistribution: prev?.satisfactionDistribution || {},
                schools
            }));
        } catch (error) {
            console.error('Error loading schools:', error);
        }
    };

    const calculateAnalytics = () => {
        // Calculate rating distribution
        const ratingDistribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let totalRating = 0;

        feedback.forEach(f => {
            ratingDistribution[f.rating]++;
            totalRating += f.rating;
        });

        // Calculate feature usage from surveys
        const featureUsage: { [key: string]: number } = {};
        surveys.forEach(survey => {
            const features = survey.answers.features as string[];
            if (features) {
                features.forEach(feature => {
                    featureUsage[feature] = (featureUsage[feature] || 0) + 1;
                });
            }
        });

        // Calculate satisfaction distribution
        const satisfactionDistribution: { [key: string]: number } = {};
        surveys.forEach(survey => {
            const satisfaction = survey.answers.satisfaction as string;
            if (satisfaction) {
                satisfactionDistribution[satisfaction] = (satisfactionDistribution[satisfaction] || 0) + 1;
            }
        });

        setAnalytics(prev => ({
            totalFeedback: feedback.length,
            totalSurveys: surveys.length,
            averageRating: feedback.length > 0 ? totalRating / feedback.length : 0,
            ratingDistribution,
            featureUsage,
            satisfactionDistribution,
            schools: prev?.schools || {}
        }));
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleLogout = async () => {
        try {
            await auth().signOut();
            router.replace('/(auth)/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderOverview = () => (
        <View style={styles.tabContent}>
            {analytics && (
                <>
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Ionicons name="chatbubble-ellipses" size={24} color="#4f46e5" />
                            <Text style={styles.statNumber}>{analytics.totalFeedback}</Text>
                            <Text style={styles.statLabel}>Total Feedback</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Ionicons name="clipboard" size={24} color="#059669" />
                            <Text style={styles.statNumber}>{analytics.totalSurveys}</Text>
                            <Text style={styles.statLabel}>Total Surveys</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Ionicons name="star" size={24} color="#fbbf24" />
                            <Text style={styles.statNumber}>{analytics.averageRating.toFixed(1)}</Text>
                            <Text style={styles.statLabel}>Avg Rating</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Rating Distribution</Text>
                        {[5, 4, 3, 2, 1].map(rating => (
                            <View key={rating} style={styles.ratingBar}>
                                <Text style={styles.ratingLabel}>{rating} ⭐</Text>
                                <View style={styles.ratingBarContainer}>
                                    <View
                                        style={[
                                            styles.ratingBarFill,
                                            {
                                                width: `${analytics.totalFeedback > 0 ? (analytics.ratingDistribution[rating] / analytics.totalFeedback) * 100 : 0}%`
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={styles.ratingCount}>{analytics.ratingDistribution[rating]}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Most Used Features</Text>
                        {Object.entries(analytics.featureUsage)
                            .sort(([, a], [, b]) => b - a)
                            .map(([feature, count]) => (
                                <View key={feature} style={styles.featureItem}>
                                    <Text style={styles.featureName}>{feature}</Text>
                                    <Text style={styles.featureCount}>{count} users</Text>
                                </View>
                            ))}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Satisfaction Levels</Text>
                        {Object.entries(analytics.satisfactionDistribution)
                            .sort(([, a], [, b]) => b - a)
                            .map(([satisfaction, count]) => (
                                <View key={satisfaction} style={styles.satisfactionItem}>
                                    <Text style={styles.satisfactionName}>{satisfaction}</Text>
                                    <Text style={styles.satisfactionCount}>{count} users</Text>
                                </View>
                            ))}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Schools</Text>
                        {analytics?.schools && Object.keys(analytics.schools).length > 0 ? (
                            Object.entries(analytics.schools)
                                .sort(([, a], [, b]) => b.userCount - a.userCount)
                                .map(([schoolId, school]) => (
                                    <View key={schoolId} style={styles.schoolItem}>
                                        <View style={styles.schoolHeader}>
                                            <Text style={styles.schoolName}>{school.name}</Text>
                                            <Text style={styles.schoolUserCount}>{school.userCount} users</Text>
                                        </View>
                                        <View style={styles.schoolRoles}>
                                            {Object.entries(school.roles).map(([role, count]) => (
                                                <View key={role} style={styles.roleBadge}>
                                                    <Text style={styles.roleText}>{role}: {count}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ))
                        ) : (
                            <Text style={styles.noDataText}>
                                No schools found. Total users: {analytics?.schools ? Object.keys(analytics.schools).length : 'N/A'}
                            </Text>
                        )}
                    </View>
                </>
            )}
        </View>
    );

    const renderFeedback = () => (
        <View style={styles.tabContent}>
            {feedback.map((item) => (
                <View key={item.id} style={styles.feedbackCard}>
                    <View style={styles.feedbackHeader}>
                        <View style={styles.ratingDisplay}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <Ionicons
                                    key={star}
                                    name={star <= item.rating ? "star" : "star-outline"}
                                    size={16}
                                    color={star <= item.rating ? "#fbbf24" : "#d1d5db"}
                                />
                            ))}
                        </View>
                        <Text style={styles.feedbackDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    {item.comment && (
                        <Text style={styles.feedbackComment}>{item.comment}</Text>
                    )}
                    <Text style={styles.feedbackEmail}>
                        {item.email || item.userEmail || 'Anonymous'}
                    </Text>
                </View>
            ))}
        </View>
    );

    const renderSurveys = () => (
        <View style={styles.tabContent}>
            {surveys.map((survey) => (
                <View key={survey.id} style={styles.surveyCard}>
                    <Text style={styles.surveyDate}>{formatDate(survey.createdAt)}</Text>
                    <Text style={styles.surveyEmail}>{survey.userEmail || 'Anonymous'}</Text>

                    {Object.entries(survey.answers).map(([question, answer]) => (
                        <View key={question} style={styles.surveyAnswer}>
                            <Text style={styles.surveyQuestion}>{question}:</Text>
                            <Text style={styles.surveyAnswerText}>
                                {Array.isArray(answer) ? answer.join(', ') : answer}
                            </Text>
                        </View>
                    ))}

                    {survey.suggestion && (
                        <View style={styles.surveyAnswer}>
                            <Text style={styles.surveyQuestion}>Suggestion:</Text>
                            <Text style={styles.surveyAnswerText}>{survey.suggestion}</Text>
                        </View>
                    )}
                </View>
            ))}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#dc2626" />
            <LinearGradient
                colors={['#dc2626', '#b91c1c']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <View style={styles.headerInfo}>
                        <Ionicons name="shield-checkmark" size={24} color="#fff" />
                        <Text style={styles.headerTitle}>Super Admin Dashboard</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
                            <Ionicons name="refresh" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
                            <Ionicons name="log-out-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
                <Text style={styles.headerSubtitle}>Analytics & Feedback Management</Text>
            </LinearGradient>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
                    onPress={() => setActiveTab('overview')}
                >
                    <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                        Overview
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'feedback' && styles.activeTab]}
                    onPress={() => setActiveTab('feedback')}
                >
                    <Text style={[styles.tabText, activeTab === 'feedback' && styles.activeTabText]}>
                        Feedback ({feedback.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'surveys' && styles.activeTab]}
                    onPress={() => setActiveTab('surveys')}
                >
                    <Text style={[styles.tabText, activeTab === 'surveys' && styles.activeTabText]}>
                        Surveys ({surveys.length})
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Loading dashboard data...</Text>
                    </View>
                ) : (
                    <>
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'feedback' && renderFeedback()}
                        {activeTab === 'surveys' && renderSurveys()}
                    </>
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
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    headerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
        marginHorizontal: 4,
    },
    activeTab: {
        backgroundColor: '#fef2f2',
    },
    tabText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    activeTabText: {
        color: '#dc2626',
        fontWeight: '700',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    tabContent: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    loadingText: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '500',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
        textAlign: 'center',
    },
    section: {
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
    },
    ratingBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    ratingLabel: {
        width: 60,
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    ratingBarContainer: {
        flex: 1,
        height: 8,
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        marginHorizontal: 12,
        overflow: 'hidden',
    },
    ratingBarFill: {
        height: '100%',
        backgroundColor: '#fbbf24',
        borderRadius: 4,
    },
    ratingCount: {
        width: 30,
        fontSize: 14,
        color: '#64748b',
        textAlign: 'right',
    },
    featureItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    featureName: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '500',
    },
    featureCount: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    satisfactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    satisfactionName: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '500',
    },
    satisfactionCount: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    schoolItem: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    schoolHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    schoolName: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '600',
    },
    schoolUserCount: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    schoolRoles: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    roleBadge: {
        backgroundColor: '#e0f2fe',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#90cdf4',
    },
    roleText: {
        fontSize: 12,
        color: '#2b6cb0',
        fontWeight: '600',
    },
    noDataText: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        paddingVertical: 20,
    },
    feedbackCard: {
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
    feedbackHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    ratingDisplay: {
        flexDirection: 'row',
        gap: 2,
    },
    feedbackDate: {
        fontSize: 12,
        color: '#64748b',
    },
    feedbackComment: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
        marginBottom: 12,
    },
    feedbackEmail: {
        fontSize: 14,
        color: '#dc2626',
        fontWeight: '600',
    },
    surveyCard: {
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
    surveyDate: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 4,
    },
    surveyEmail: {
        fontSize: 16,
        color: '#dc2626',
        fontWeight: '600',
        marginBottom: 16,
    },
    surveyAnswer: {
        marginBottom: 12,
    },
    surveyQuestion: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'capitalize',
    },
    surveyAnswerText: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 22,
    },
}); 