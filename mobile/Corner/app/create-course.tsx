import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { auth, db } from '../config/ firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import { createCourse } from './(auth)/useCourses';
import { router } from 'expo-router';

export default function CreateCourseScreen() {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [code, setCode] = useState('');
    const [teacherName, setTeacherName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch teacher's name from their profile
        const fetchTeacherName = async () => {
            try {
                const user = auth.currentUser;
                if (user) {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setTeacherName(userData.name || 'Unknown Teacher');
                    }
                }
            } catch (error) {
                console.error('Error fetching teacher name:', error);
                setTeacherName('Unknown Teacher');
            }
        };

        fetchTeacherName();
    }, []);

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('Please enter a course name');
            return;
        }

        setLoading(true);
        try {
            const teacherId = auth.currentUser?.uid;
            if (!teacherId) {
                setError('No teacher ID found');
                return;
            }

            const { code } = await createCourse(name, desc, teacherId, teacherName);
            setCode(code);
            setTimeout(() => {
                router.replace('/(tabs)');
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
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
                <Text style={styles.title}>Create a Course</Text>

                {/* Display teacher name instead of input */}
                <View style={styles.teacherInfo}>
                    <Text style={styles.teacherLabel}>Instructor:</Text>
                    <Text style={styles.teacherName}>{teacherName}</Text>
                </View>

                <TextInput
                    style={styles.input}
                    placeholder="Course Name"
                    placeholderTextColor="#666"
                    value={name}
                    onChangeText={setName}
                />

                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description (optional)"
                    placeholderTextColor="#666"
                    value={desc}
                    onChangeText={setDesc}
                    multiline
                    numberOfLines={4}
                />

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleCreate}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'Creating...' : 'Create Course'}
                    </Text>
                </TouchableOpacity>

                {code && (
                    <View style={styles.successContainer}>
                        <Text style={styles.successText}>Course created successfully!</Text>
                        <Text style={styles.codeText}>Course Code: {code}</Text>
                        <Text style={styles.redirectText}>Redirecting to dashboard...</Text>
                    </View>
                )}
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
        marginBottom: 24,
        textAlign: 'center',
    },
    teacherInfo: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    teacherLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 4,
    },
    teacherName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#81171b',
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#fff',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
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
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
        fontWeight: '500',
    },
    successContainer: {
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#bbf7d0',
        alignItems: 'center',
    },
    successText: {
        color: '#166534',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    codeText: {
        color: '#15803d',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    redirectText: {
        color: '#65a30d',
        fontSize: 14,
        fontStyle: 'italic',
    },
});
