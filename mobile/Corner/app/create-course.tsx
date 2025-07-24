import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable, StatusBar, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { createCourse } from '../services/courseService';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
                const user = auth().currentUser;
                if (user) {
                    const userDoc = await firestore().collection('users').doc(user.uid).get();
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setTeacherName(userData?.name || 'Unknown Teacher');
                    }
                }
            } catch (error) {
                console.error('Error fetching teacher name:', error);
                setTeacherName('Unknown Teacher');
            }
        };

        fetchTeacherName();
    }, []);

    const renderLogoSection = () => {
        return (
            <View style={styles.logoSection}>
                <View style={styles.logoIconContainer}>
                    <Text style={styles.logoIconText}>C</Text>
                </View>
            </View>
        );
    };

    const handleCreate = async () => {
        // Dismiss keyboard when creating course
        Keyboard.dismiss();

        if (!name.trim()) {
            setError('Please enter a course name');
            return;
        }

        setLoading(true);
        try {
            const teacherId = auth().currentUser?.uid;
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

    const dismissKeyboard = () => {
        Keyboard.dismiss();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
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
                    {renderLogoSection()}
                    <Text style={styles.headerTitle}>Create Course</Text>
                    <Text style={styles.headerSubtitle}>Set up your new course</Text>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Pressable style={styles.formContainer} onPress={dismissKeyboard}>
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
                            returnKeyType="next"
                        />

                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Description (optional)"
                            placeholderTextColor="#666"
                            value={desc}
                            onChangeText={setDesc}
                            multiline
                            numberOfLines={4}
                            returnKeyType="done"
                            blurOnSubmit={true}
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
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
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
        paddingTop: 20,
    },
    backButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'transparent',
        marginBottom: 16,
    },
    headerContent: {
        alignItems: 'center',
    },
    logoSection: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    logoIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4f46e5',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    logoIconText: {
        fontSize: 42,
        fontWeight: '800',
        color: '#ffffff',
        fontFamily: 'Georgia',
        letterSpacing: 4,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
        paddingTop: 40,
        paddingBottom: 40,
    },
    formContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
        minHeight: 400,
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
        color: '#4f46e5',
    },
    input: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#fff',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    button: {
        backgroundColor: '#4f46e5',
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
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
