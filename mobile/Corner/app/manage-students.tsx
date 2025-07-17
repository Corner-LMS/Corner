import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface Student {
    id: string;
    name: string;
    email: string;
    joinedAt: string;
    lastActive?: string;
}

// Custom Confirmation Modal Component
const ConfirmationModal = ({ visible, onClose, onConfirm, title, message, confirmText, cancelText }: {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
}) => {
    if (!visible) return null;

    return (
        <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} />
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Ionicons name="warning" size={24} color="#f59e0b" />
                    <Text style={styles.modalTitle}>{title}</Text>
                </View>

                <Text style={styles.modalMessage}>{message}</Text>

                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                        <Text style={styles.cancelButtonText}>{cancelText}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
                        <Text style={styles.confirmButtonText}>{confirmText}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default function ManageStudentsScreen() {
    const params = useLocalSearchParams();
    const courseId = params.courseId as string;
    const courseName = params.courseName as string;
    const courseCode = params.courseCode as string;

    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingStudent, setRemovingStudent] = useState<string | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [studentToRemove, setStudentToRemove] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => {
        loadStudents();
    }, [courseId]);

    const loadStudents = async () => {
        try {
            setLoading(true);

            // Get all students enrolled in this course
            const studentsQuery = await firestore()
                .collection('users')
                .where('role', '==', 'student')
                .where('courseIds', 'array-contains', courseId)
                .get();

            const studentsList: Student[] = [];

            for (const studentDoc of studentsQuery.docs) {
                const studentData = studentDoc.data();
                const joinedAt = studentData.courseJoinDates?.[courseId] || new Date().toISOString();

                studentsList.push({
                    id: studentDoc.id,
                    name: studentData.name || 'Unknown Student',
                    email: studentData.email || '',
                    joinedAt: joinedAt,
                    lastActive: studentData.lastActive || null
                });
            }

            // Sort by join date (newest first)
            studentsList.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

            setStudents(studentsList);
        } catch (error) {
            console.error('Error loading students:', error);
            Alert.alert('Error', 'Failed to load students. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveStudent = async (studentId: string, studentName: string) => {
        setStudentToRemove({ id: studentId, name: studentName });
        setShowConfirmation(true);
    };

    const handleConfirmRemove = async () => {
        if (!studentToRemove) return;

        try {
            setRemovingStudent(studentToRemove.id);

            // Remove course from student's courseIds
            await firestore().collection('users').doc(studentToRemove.id).update({
                courseIds: firestore.FieldValue.arrayRemove(courseId),
                [`courseJoinDates.${courseId}`]: firestore.FieldValue.delete()
            });

            // Remove student from the list
            setStudents(prev => prev.filter(student => student.id !== studentToRemove.id));

            // Show success message (you can add a custom success modal here if needed)
            console.log('Success', `${studentToRemove.name} has been removed from the course.`);
        } catch (error) {
            console.error('Error removing student:', error);
            // Show error message (you can add a custom error modal here if needed)
            console.log('Error', 'Failed to remove student. Please try again.');
        } finally {
            setRemovingStudent(null);
            setShowConfirmation(false);
            setStudentToRemove(null);
        }
    };

    const handleCancelRemove = () => {
        setShowConfirmation(false);
        setStudentToRemove(null);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getInitials = (name: string) => {
        const nameParts = name.trim().split(' ');
        if (nameParts.length >= 2) {
            return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        } else {
            return name.substring(0, 2).toUpperCase();
        }
    };

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
                        <Text style={styles.headerTitle}>Manage Students</Text>
                        <Text style={styles.courseName}>{courseName}</Text>
                        <Text style={styles.courseCode}>{courseCode}</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Ionicons name="people" size={24} color="#4f46e5" />
                        <Text style={styles.statNumber}>{students.length}</Text>
                        <Text style={styles.statLabel}>Enrolled Students</Text>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#4f46e5" />
                        <Text style={styles.loadingText}>Loading students...</Text>
                    </View>
                ) : students.length > 0 ? (
                    <ScrollView style={styles.studentsList} showsVerticalScrollIndicator={false}>
                        {students.map((student) => (
                            <View key={student.id} style={styles.studentCard}>
                                <View style={styles.studentInfo}>
                                    <View style={styles.studentAvatar}>
                                        <Text style={styles.avatarText}>
                                            {getInitials(student.name)}
                                        </Text>
                                    </View>

                                    <View style={styles.studentDetails}>
                                        <Text style={styles.studentName}>{student.name}</Text>
                                        <Text style={styles.studentEmail}>{student.email}</Text>
                                        <Text style={styles.joinDate}>
                                            Joined {formatDate(student.joinedAt)}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.studentActions}>
                                    <TouchableOpacity
                                        style={styles.messageButton}
                                        onPress={() => router.push({
                                            pathname: '/compose-message',
                                            params: {
                                                userId: student.id,
                                                userName: student.name,
                                                courseId: courseId,
                                                courseName: courseName
                                            }
                                        })}
                                    >
                                        <Ionicons name="mail" size={18} color="#0ea5e9" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.removeButton,
                                            removingStudent === student.id && styles.removeButtonDisabled
                                        ]}
                                        onPress={() => handleRemoveStudent(student.id, student.name)}
                                        disabled={removingStudent === student.id}
                                    >
                                        {removingStudent === student.id ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Ionicons name="person-remove" size={18} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={64} color="#cbd5e0" />
                        <Text style={styles.emptyStateTitle}>No Students Yet</Text>
                        <Text style={styles.emptyStateText}>
                            Students will appear here once they enroll in your course.
                        </Text>
                    </View>
                )}
            </View>

            <ConfirmationModal
                visible={showConfirmation}
                onClose={handleCancelRemove}
                onConfirm={handleConfirmRemove}
                title="Remove Student"
                message={`Are you sure you want to remove ${studentToRemove?.name} from this course?`}
                confirmText="Remove"
                cancelText="Cancel"
            />
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
        marginRight: 16,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    courseName: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '600',
    },
    courseCode: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
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
        padding: 20,
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
        color: '#1a202c',
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 14,
        color: '#64748b',
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
        color: '#64748b',
        fontWeight: '500',
    },
    studentsList: {
        flex: 1,
    },
    studentCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    studentInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    studentAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    studentDetails: {
        flex: 1,
    },
    studentName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a202c',
        marginBottom: 2,
    },
    studentEmail: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 4,
    },
    joinDate: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    removeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButtonDisabled: {
        backgroundColor: '#fca5a5',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a202c',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
    },
    modalBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '80%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a202c',
        marginLeft: 8,
    },
    modalMessage: {
        fontSize: 16,
        color: '#4a5568',
        textAlign: 'center',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    cancelButton: {
        backgroundColor: '#edf2f7',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: '#cbd5e0',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4a5568',
    },
    confirmButton: {
        backgroundColor: '#ef4444',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    studentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 16,
    },
    messageButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f9ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#0ea5e9',
    },
}); 