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
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        padding: 20,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backButtonText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    formContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 17,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 24,
        fontWeight: '500',
    },
    note: {
        fontSize: 15,
        color: '#4f46e5',
        textAlign: 'center',
        marginBottom: 32,
        fontWeight: '600',
        fontStyle: 'italic',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    input: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 20,
        fontSize: 20,
        color: '#1e293b',
        backgroundColor: '#fff',
        marginBottom: 32,
        textAlign: 'center',
        fontWeight: '700',
        letterSpacing: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    button: {
        backgroundColor: '#4f46e5',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
    },
    buttonDisabled: {
        backgroundColor: '#94a3b8',
        shadowOpacity: 0.1,
    },
    buttonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
