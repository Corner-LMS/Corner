import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Pressable, TextInput, Alert, ScrollView, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveUserRole, saveUserName, saveUserSchool } from '../services/authService';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SCHOOLS, School } from '../constants/Schools';

const { height: screenHeight } = Dimensions.get('window');

export default function RoleSelectionScreen() {
    const [name, setName] = useState('');
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'school' | 'name' | 'role'>('school');

    const selectSchool = (school: School) => {
        setSelectedSchool(school);
        setStep('name');
    };

    const proceedToRoleSelection = () => {
        if (!name.trim()) {
            Alert.alert('Name Required', 'Please enter your name before proceeding.');
            return;
        }
        setStep('role');
    };

    const selectRole = async (role: 'student' | 'teacher' | 'admin') => {
        if (!selectedSchool) {
            Alert.alert('School Required', 'Please select your school first.');
            return;
        }

        if (!name.trim()) {
            Alert.alert('Name Required', 'Please enter your name before selecting a role.');
            return;
        }

        setLoading(true);
        try {
            await saveUserSchool(selectedSchool.id);
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

    const goBack = () => {
        if (step === 'school') {
            router.back();
        } else if (step === 'name') {
            setStep('school');
        } else if (step === 'role') {
            setStep('name');
        }
    };

    const isShortScreen = screenHeight < 700;

    const renderLogoSection = () => {
        return (
            <View style={styles.logoSection}>
                <View style={styles.logoIconContainer}>
                    <Text style={styles.logoIconText}>C</Text>
                </View>
                <Text style={styles.tagline}>Connect, learn, and grow.</Text>
            </View>
        );
    };

    const renderSchoolSelection = () => (
        <>
            <View style={styles.logoBackgroundSection}>
                {renderLogoSection()}
            </View>

            <View style={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={goBack}
                    >
                        <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                    </TouchableOpacity>
                </View>

                <View style={styles.welcomeSection}>
                    <Text style={styles.welcomeTitle}>Welcome to Corner</Text>
                    <Text style={styles.welcomeSubtitle}>Select your school to get started</Text>
                </View>

                <View style={styles.schoolSection}>
                    <Text style={styles.sectionTitle}>Choose your school</Text>
                    <Text style={styles.sectionSubtitle}>This will determine your access and permissions</Text>

                    <View style={styles.schoolGrid}>
                        {SCHOOLS.map((school) => (
                            <TouchableOpacity
                                key={school.id}
                                style={styles.schoolCard}
                                onPress={() => selectSchool(school)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.schoolCardContent}>
                                    <Text style={styles.schoolCardTitle}>{school.shortName}</Text>
                                    <Text style={styles.schoolCardName}>{school.name}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#4f46e5" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </>
    );

    const renderNameInput = () => (
        <>
            <View style={styles.logoBackgroundSection}>
                {renderLogoSection()}
            </View>

            <View style={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={goBack}
                    >
                        <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                    </TouchableOpacity>
                </View>

                <View style={styles.welcomeSection}>
                    <Text style={styles.welcomeTitle}>Welcome to Corner</Text>
                    <Text style={styles.welcomeSubtitle}>
                        {selectedSchool?.shortName} • Enter your details
                    </Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputSection}>
                        <Text style={styles.inputLabel}>Your Name</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color="#4f46e5" style={styles.inputIcon} />
                            <TextInput
                                style={styles.nameInput}
                                placeholder="Enter your full name"
                                placeholderTextColor="#94a3b8"
                                value={name}
                                onChangeText={handleNameChange}
                                editable={!loading}
                                autoFocus
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.continueButton, !name.trim() && styles.continueButtonDisabled]}
                        onPress={proceedToRoleSelection}
                        disabled={!name.trim()}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.continueButtonText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </>
    );

    const renderRoleSelection = () => (
        <>
            <View style={styles.logoBackgroundSection}>
                {renderLogoSection()}
            </View>

            <View style={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={goBack}
                    >
                        <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                    </TouchableOpacity>
                </View>

                <View style={styles.welcomeSection}>
                    <Text style={styles.welcomeTitle}>Welcome {name}!</Text>
                    <Text style={styles.welcomeSubtitle}>
                        {selectedSchool?.shortName} • Choose your role
                    </Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.roleSection}>
                        <Text style={styles.roleTitle}>How will you use Corner?</Text>
                        <Text style={styles.roleSubtitle}>Select your role to continue</Text>

                        <View style={styles.roleButtonContainer}>
                            <TouchableOpacity
                                style={[styles.roleButton, styles.studentButton]}
                                onPress={() => selectRole('student')}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <View style={styles.roleIconContainer}>
                                    <Ionicons name="book-outline" size={28} color="#fff" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={styles.roleButtonTitle}>Student</Text>
                                    <Text style={styles.roleButtonDescription}>
                                        Join courses and participate in discussions
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
                                <View style={styles.roleIconContainer}>
                                    <Ionicons name="school-outline" size={28} color="#fff" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={styles.roleButtonTitle}>Teacher</Text>
                                    <Text style={styles.roleButtonDescription}>
                                        Create courses and manage discussions
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.roleButton, styles.adminButton]}
                                onPress={() => selectRole('admin')}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <View style={styles.roleIconContainer}>
                                    <Ionicons name="shield-outline" size={28} color="#fff" />
                                </View>
                                <View style={styles.roleTextContainer}>
                                    <Text style={styles.roleButtonTitle}>Admin</Text>
                                    <Text style={styles.roleButtonDescription}>
                                        Manage school-wide settings and users
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 'school' && renderSchoolSelection()}
                    {step === 'name' && renderNameInput()}
                    {step === 'role' && renderRoleSelection()}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    // Logo Background Section - matches welcome screen
    logoBackgroundSection: {
        width: '100%',
        height: 280,
        backgroundColor: '#4f46e5',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
        paddingBottom: 20,
    },
    logoSection: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        backgroundColor: 'transparent',
    },
    logoIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#4f46e5',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 24,
    },
    logoIconText: {
        fontSize: 50,
        fontWeight: '800',
        color: '#ffffff',
        fontFamily: 'Georgia',
        letterSpacing: 4,
    },
    tagline: {
        fontSize: 20,
        color: '#e0e7ff',
        fontWeight: '600',
        letterSpacing: 0.5,
        textAlign: 'center',
        lineHeight: 24,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    welcomeSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    welcomeSubtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '500',
    },
    schoolSection: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
        fontWeight: '500',
    },
    schoolGrid: {
        gap: 12,
    },
    schoolCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    schoolCardContent: {
        flex: 1,
    },
    schoolCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    schoolCardName: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    form: {
        flex: 1,
    },
    inputSection: {
        marginBottom: 32,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    inputIcon: {
        marginRight: 12,
    },
    nameInput: {
        flex: 1,
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '500',
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4f46e5',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 16,
        elevation: 6,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        gap: 10,
    },
    continueButtonDisabled: {
        opacity: 0.6,
        backgroundColor: '#94a3b8',
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    roleSection: {
        flex: 1,
    },
    roleTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
    },
    roleSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 32,
        fontWeight: '500',
    },
    roleButtonContainer: {
        gap: 16,
    },
    roleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    studentButton: {
        backgroundColor: '#0891b2',
    },
    teacherButton: {
        backgroundColor: '#4f46e5',
    },
    adminButton: {
        backgroundColor: '#059669',
    },
    roleIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    roleTextContainer: {
        flex: 1,
    },
    roleButtonTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    roleButtonDescription: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        lineHeight: 20,
    },
});
