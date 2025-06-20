import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Pressable, StatusBar } from 'react-native';
import { db, auth } from '../config/ firebase-config';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function JoinCourseScreen() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleJoin = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'You must be logged in to join a course.');
                return;
            }

            // Get current user data to check their school
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                Alert.alert('Error', 'User profile not found.');
                setLoading(false);
                return;
            }

            const userData = userSnap.data();
            const userSchoolId = userData.schoolId;

            if (!userSchoolId) {
                Alert.alert('Error', 'Your account is not associated with any school. Please contact support.');
                setLoading(false);
                return;
            }

            // Find course by code
            const q = query(collection(db, 'courses'), where('code', '==', code.trim().toUpperCase()));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                Alert.alert('Invalid Code', 'No course found with this code. Please verify the code and try again.');
                setLoading(false);
                return;
            }

            const courseDoc = snapshot.docs[0];
            const courseId = courseDoc.id;
            const courseData = courseDoc.data();

            // Verify school match
            if (courseData.schoolId !== userSchoolId) {
                Alert.alert(
                    'Access Denied',
                    'This course does not belong to your school. Please verify the course code.',
                    [{ text: 'OK', style: 'default' }]
                );
                setLoading(false);
                return;
            }

            // Check if student is already enrolled
            const currentCourseIds = userData?.courseIds || [];
            if (currentCourseIds.includes(courseId)) {
                Alert.alert('Already Enrolled', 'You are already enrolled in this course.');
                setLoading(false);
                return;
            }

            // Update student's user document with course details
            await updateDoc(userRef, {
                courseIds: [...currentCourseIds, courseId],
                courseJoinDates: {
                    ...(userData?.courseJoinDates || {}),
                    [courseId]: new Date().toISOString()
                }
            });

            Alert.alert(
                'Success',
                `You have successfully joined "${courseData.name}"!`,
                [
                    {
                        text: 'View Course',
                        onPress: () => {
                            router.push({
                                pathname: '/course-detail',
                                params: {
                                    courseId: courseId,
                                    courseName: courseData.name,
                                    courseCode: courseData.code,
                                    instructorName: courseData.instructorName || 'Unknown',
                                    role: 'student'
                                }
                            });
                        }
                    },
                    {
                        text: 'Go to Dashboard',
                        onPress: () => router.replace('/(tabs)')
                    }
                ]
            );
        } catch (err) {
            console.error('Error joining course:', err);
            Alert.alert('Error', 'Something went wrong. Please check your internet connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />

            {/* Header Gradient */}
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </Pressable>

                <View style={styles.headerContent}>
                    <View style={styles.headerIcon}>
                        <Ionicons name="school" size={32} color="#fff" />
                    </View>
                    <Text style={styles.headerTitle}>Join Course</Text>
                    <Text style={styles.headerSubtitle}>Enter your course code</Text>
                </View>
            </LinearGradient>

            <View style={styles.formContainer}>
                <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Course Code</Text>
                    <TextInput
                        placeholder="ABC123"
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                        style={styles.input}
                        placeholderTextColor="#9ca3af"
                        maxLength={8}
                    />
                </View>

                <View style={styles.noteContainer}>
                    <Ionicons name="information-circle" size={20} color="#4f46e5" />
                    <Text style={styles.note}>
                        You can only join courses from your school
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleJoin}
                    disabled={loading || !code.trim()}
                >
                    <LinearGradient
                        colors={loading ? ['#94a3b8', '#64748b'] : ['#4f46e5', '#3730a3']}
                        style={styles.buttonGradient}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? 'Joining...' : 'Join Course'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    backButton: {
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 12,
        marginBottom: 20,
    },
    headerContent: {
        alignItems: 'center',
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        fontWeight: '500',
    },
    formContainer: {
        flex: 1,
        padding: 20,
        paddingTop: 40,
    },
    inputSection: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a202c',
        marginBottom: 12,
    },
    input: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 20,
        fontSize: 24,
        color: '#1a202c',
        backgroundColor: '#fff',
        textAlign: 'center',
        fontWeight: '700',
        letterSpacing: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
        marginBottom: 32,
    },
    note: {
        fontSize: 14,
        color: '#4f46e5',
        fontWeight: '500',
        marginLeft: 8,
        flex: 1,
    },
    button: {
        borderRadius: 16,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonGradient: {
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    buttonDisabled: {
        shadowOpacity: 0.1,
    },
    buttonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
