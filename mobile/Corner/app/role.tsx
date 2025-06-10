import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Pressable, TextInput, Alert } from 'react-native';
import { saveUserRole, saveUserName } from './(auth)/useAuth';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function RoleSelectionScreen() {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const selectRole = async (role: 'student' | 'teacher' | 'admin') => {
        if (!name.trim()) {
            Alert.alert('Name Required', 'Please enter your name before selecting a role.');
            return;
        }

        setLoading(true);
        try {
            await saveUserName(name.trim());
            await saveUserRole(role);
            if (role === 'teacher' || role === 'admin') {
                router.replace('/(tabs)');
            } else {
                router.replace('/(tabs)');
            }
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to set up your account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleNameChange = (text: string) => {
        setName(text);
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
                <Ionicons name="arrow-back" size={24} color="#81171b" />
                <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="school-outline" size={48} color="#81171b" />
                    </View>
                    <Text style={styles.welcomeText}>Welcome to Corner</Text>
                    <Text style={styles.subtitle}>Let's set up your account</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>Your Name</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color="#81171b" style={styles.inputIcon} />
                            <TextInput
                                style={styles.nameInput}
                                placeholder="Enter your full name"
                                placeholderTextColor="#94a3b8"
                                value={name}
                                onChangeText={handleNameChange}
                                editable={!loading}
                            />
                        </View>
                    </View>

                    <View style={styles.roleSection}>
                        <Text style={styles.roleTitle}>Choose your role</Text>
                        <Text style={styles.roleSubtitle}>Select how you'll be using Corner</Text>

                        <View style={styles.roleButtonContainer}>
                            <TouchableOpacity
                                style={[styles.roleButton, styles.studentButton]}
                                onPress={() => selectRole('student')}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <View style={styles.roleIconContainer}>
                                    <Ionicons name="book-outline" size={32} color="#fff" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={styles.roleButtonTitle}>Student</Text>
                                    <Text style={styles.roleButtonDescription}>
                                        Join courses, participate in discussions, and access learning materials
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.roleButton, styles.teacherButton]}
                                onPress={() => selectRole('teacher')}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.roleIconContainer, styles.teacherIconContainer]}>
                                    <Ionicons name="desktop-outline" size={32} color="#81171b" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={[styles.roleButtonTitle, styles.teacherButtonTitle]}>Teacher</Text>
                                    <Text style={[styles.roleButtonDescription, styles.teacherButtonDescription]}>
                                        Create courses, manage students, and share educational content
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="rgba(129, 23, 27, 0.7)" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.roleButton, styles.adminButton]}
                                onPress={() => selectRole('admin')}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.roleIconContainer, styles.adminIconContainer]}>
                                    <Ionicons name="shield-checkmark-outline" size={32} color="#f59e0b" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={[styles.roleButtonTitle, styles.adminButtonTitle]}>Admin</Text>
                                    <Text style={[styles.roleButtonDescription, styles.adminButtonDescription]}>
                                        Manage courses, view analytics, post announcements, and oversee platform
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="rgba(245, 158, 11, 0.7)" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {loading && (
                    <View style={styles.loadingOverlay}>
                        <Text style={styles.loadingText}>Setting up your account...</Text>
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
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
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
    content: {
        flex: 1,
        padding: 20,
        paddingTop: 100,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(129, 23, 27, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    welcomeText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '500',
    },
    form: {
        flex: 1,
    },
    inputSection: {
        marginBottom: 40,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    inputIcon: {
        marginRight: 12,
    },
    nameInput: {
        flex: 1,
        height: 56,
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '500',
    },
    roleSection: {
        flex: 1,
    },
    roleTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    roleSubtitle: {
        fontSize: 16,
        color: '#64748b',
        marginBottom: 24,
        fontWeight: '500',
    },
    roleButtonContainer: {
        gap: 16,
    },
    roleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    studentButton: {
        backgroundColor: '#81171b',
    },
    teacherButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#81171b',
    },
    roleIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    teacherIconContainer: {
        backgroundColor: 'rgba(129, 23, 27, 0.1)',
    },
    roleTextContainer: {
        flex: 1,
        marginRight: 12,
    },
    roleButtonTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    teacherButtonTitle: {
        color: '#81171b',
    },
    roleButtonDescription: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        lineHeight: 20,
        fontWeight: '500',
    },
    teacherButtonDescription: {
        color: '#64748b',
    },
    loadingOverlay: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(129, 23, 27, 0.9)',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    adminButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#f59e0b',
    },
    adminIconContainer: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    adminButtonTitle: {
        color: '#f59e0b',
    },
    adminButtonDescription: {
        color: '#64748b',
    },
});
