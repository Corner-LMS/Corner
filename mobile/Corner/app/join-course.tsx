import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { db, auth } from '../config/ firebase-config';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { router } from 'expo-router';

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
            <Pressable
                style={styles.backButton}
                onPress={() => router.back()}
            >
                <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <View style={styles.formContainer}>
                <Text style={styles.title}>Join a Course</Text>
                <Text style={styles.subtitle}>Enter the course code provided by your teacher</Text>
                <Text style={styles.note}>
                    Note: You can only join courses from your school
                </Text>

                <TextInput
                    placeholder="Enter course code (e.g., ABC123)"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    style={styles.input}
                    placeholderTextColor="#666"
                    maxLength={8}
                />

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleJoin}
                    disabled={loading || !code.trim()}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'Joining...' : 'Join Course'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        padding: 20,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        padding: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    backButtonText: {
        color: '#81171b',
        fontSize: 16,
        fontWeight: '600',
    },
    formContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 22,
    },
    note: {
        fontSize: 14,
        color: '#81171b',
        textAlign: 'center',
        marginBottom: 24,
        fontWeight: '500',
        fontStyle: 'italic',
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        color: '#1e293b',
        backgroundColor: '#fff',
        marginBottom: 24,
        textAlign: 'center',
        fontWeight: '600',
        letterSpacing: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    button: {
        backgroundColor: '#81171b',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#81171b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: '#94a3b8',
        shadowOpacity: 0.1,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
