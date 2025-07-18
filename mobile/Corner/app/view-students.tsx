import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface Student {
    id: string;
    name: string;
    email: string;
    joinedAt?: string;
}

function ViewStudentsScreen() {
    const params = useLocalSearchParams();
    const courseId = params.courseId as string;
    const courseName = params.courseName as string;
    const role = params.role as string;

    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        loadStudents();
    }, [courseId]);

    const loadStudents = async () => {
        try {
            setLoading(true);
            const user = auth().currentUser;
            if (!user) return;

            // Get current user data
            const userDoc = await firestore().collection('users').doc(user.uid).get();
            if (userDoc.exists()) {
                setCurrentUser(userDoc.data());
            }

            // Get all students enrolled in this course
            const studentsQuery = await firestore()
                .collection('users')
                .where('role', '==', 'student')
                .where('courseIds', 'array-contains', courseId)
                .get();

            const studentsList: Student[] = [];

            for (const studentDoc of studentsQuery.docs) {
                const studentData = studentDoc.data();
                studentsList.push({
                    id: studentDoc.id,
                    name: studentData.name || 'Unknown Student',
                    email: studentData.email || '',
                    joinedAt: studentData.courseJoinDates?.[courseId] || ''
                });
            }

            // Sort by name
            studentsList.sort((a, b) => a.name.localeCompare(b.name));
            setStudents(studentsList);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string) => {
        const nameParts = name.trim().split(' ');
        if (nameParts.length >= 2) {
            return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        } else {
            return name.substring(0, 2).toUpperCase();
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
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
                        <Text style={styles.headerTitle}>Students</Text>
                        <View style={styles.headerSpacer} />
                    </View>
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4f46e5" />
                    <Text style={styles.loadingText}>Loading students...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
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
                        <Text style={styles.headerTitle}>Students</Text>
                        <Text style={styles.headerSubtitle}>{courseName}</Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Ionicons name="people" size={24} color="#4f46e5" />
                        <Text style={styles.statNumber}>{students.length}</Text>
                        <Text style={styles.statLabel}>
                            {students.length === 1 ? 'Student' : 'Students'}
                        </Text>
                    </View>
                </View>

                {students.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={64} color="#cbd5e0" />
                        <Text style={styles.emptyStateText}>No students enrolled</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Students will appear here once they join the course.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.studentsList}>
                        {students.map((student) => (
                            <View key={student.id} style={styles.studentCard}>
                                <View style={styles.studentInfo}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>
                                            {getInitials(student.name)}
                                        </Text>
                                    </View>
                                    <View style={styles.studentDetails}>
                                        <Text style={styles.studentName}>
                                            {student.name}
                                            {currentUser?.uid === student.id && (
                                                <Text style={styles.currentUserBadge}> (You)</Text>
                                            )}
                                        </Text>
                                        <Text style={styles.studentEmail}>{student.email}</Text>
                                        {student.joinedAt && (
                                            <Text style={styles.joinedDate}>
                                                Joined {formatDate(student.joinedAt)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
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
        paddingTop: 0,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    headerSpacer: {
        width: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
        fontWeight: '500',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    statsContainer: {
        marginBottom: 24,
    },
    statCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    statNumber: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1e293b',
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyStateText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyStateSubtext: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
    },
    studentsList: {
        gap: 12,
    },
    studentCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    studentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    studentDetails: {
        flex: 1,
    },
    studentName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
    },
    currentUserBadge: {
        color: '#4f46e5',
        fontWeight: '700',
    },
    studentEmail: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 2,
    },
    joinedDate: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
});

export default ViewStudentsScreen; 