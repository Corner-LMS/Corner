import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Pressable, TextInput, Alert, ScrollView, Dimensions } from 'react-native';
import { saveUserRole, saveUserName, saveUserSchool } from './(auth)/useAuth';
import { router } from 'expo-router';
import { useState } from 'react';
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

    const renderSchoolSelection = () => (
        <>
            <View style={[styles.header, isShortScreen && styles.headerShort]}>
                <View style={[styles.logoContainer, isShortScreen && styles.logoContainerShort]}>
                    <Ionicons name="school-outline" size={isShortScreen ? 36 : 48} color="#4f46e5" />
                </View>
                <Text style={[styles.welcomeText, isShortScreen && styles.welcomeTextShort]}>Welcome to Corner</Text>
                <Text style={styles.subtitle}>Select your school to get started</Text>
            </View>

            <View style={styles.schoolSection}>
                <Text style={[styles.sectionTitle, isShortScreen && styles.sectionTitleShort]}>Choose your school</Text>
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
        </>
    );

    const renderNameInput = () => (
        <>
            <View style={[styles.header, isShortScreen && styles.headerShort]}>
                <View style={[styles.logoContainer, isShortScreen && styles.logoContainerShort]}>
                    <Ionicons name="school-outline" size={isShortScreen ? 36 : 48} color="#4f46e5" />
                </View>
                <Text style={[styles.welcomeText, isShortScreen && styles.welcomeTextShort]}>Welcome to Corner</Text>
                <Text style={styles.subtitle}>
                    {selectedSchool?.shortName} • Enter your details
                </Text>
            </View>

            <View style={styles.form}>
                <View style={[styles.inputSection, isShortScreen && styles.inputSectionShort]}>
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
        </>
    );

    const renderRoleSelection = () => (
        <>
            <View style={[styles.header, isShortScreen && styles.headerShort]}>
                <View style={[styles.logoContainer, isShortScreen && styles.logoContainerShort]}>
                    <Ionicons name="school-outline" size={isShortScreen ? 36 : 48} color="#4f46e5" />
                </View>
                <Text style={[styles.welcomeText, isShortScreen && styles.welcomeTextShort]}>Welcome {name}!</Text>
                <Text style={styles.subtitle}>
                    {selectedSchool?.shortName} • Choose your role
                </Text>
            </View>

            <View style={styles.form}>
                <View style={styles.roleSection}>
                    <Text style={[styles.roleTitle, isShortScreen && styles.roleTitleShort]}>How will you use Corner?</Text>
                    <Text style={styles.roleSubtitle}>Select your role to continue</Text>

                    <View style={[styles.roleButtonContainer, isShortScreen && styles.roleButtonContainerShort]}>
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
                            <View style={[styles.roleIconContainer, styles.teacherIconContainer]}>
                                <Ionicons name="desktop-outline" size={28} color="#4f46e5" />
                            </View>
                            <View style={styles.roleTextContainer}>
                                <Text style={[styles.roleButtonTitle, styles.teacherButtonTitle]}>Teacher</Text>
                                <Text style={[styles.roleButtonDescription, styles.teacherButtonDescription]}>
                                    Create and manage courses
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="rgba(79, 70, 229, 0.7)" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.roleButton, styles.adminButton]}
                            onPress={() => selectRole('admin')}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.roleIconContainer, styles.adminIconContainer]}>
                                <Ionicons name="shield-checkmark-outline" size={28} color="#f59e0b" />
                            </View>
                            <View style={styles.roleTextContainer}>
                                <Text style={[styles.roleButtonTitle, styles.adminButtonTitle]}>Admin</Text>
                                <Text style={[styles.roleButtonDescription, styles.adminButtonDescription]}>
                                    oversee platform and analytics
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="rgba(245, 158, 11, 0.7)" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <Pressable
                style={styles.backButton}
                onPress={goBack}
            >
                <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    isShortScreen && styles.scrollContentShort
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {step === 'school' && renderSchoolSelection()}
                {step === 'name' && renderNameInput()}
                {step === 'role' && renderRoleSelection()}

                {/* Extra bottom padding to ensure content is fully visible */}
                <View style={styles.bottomPadding} />
            </ScrollView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <Text style={styles.loadingText}>Setting up your account...</Text>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
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
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    backButtonText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 100,
        paddingBottom: 40,
    },
    scrollContentShort: {
        paddingTop: 80,
        paddingBottom: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    headerShort: {
        marginBottom: 24,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    logoContainerShort: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: 16,
    },
    welcomeText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    welcomeTextShort: {
        fontSize: 28,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '500',
        textAlign: 'center',
    },
    schoolSection: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    sectionTitleShort: {
        fontSize: 20,
    },
    sectionSubtitle: {
        fontSize: 16,
        color: '#64748b',
        marginBottom: 24,
        fontWeight: '500',
    },
    schoolGrid: {
        gap: 16,
    },
    schoolCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    schoolCardContent: {
        flex: 1,
    },
    schoolCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4f46e5',
        marginBottom: 6,
        letterSpacing: -0.2,
    },
    schoolCardName: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        fontWeight: '500',
    },
    form: {
        flex: 1,
    },
    inputSection: {
        marginBottom: 40,
    },
    inputSectionShort: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 12,
        letterSpacing: -0.1,
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
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
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
    continueButton: {
        backgroundColor: '#4f46e5',
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
    },
    continueButtonDisabled: {
        backgroundColor: '#94a3b8',
        shadowOpacity: 0.1,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    roleSection: {
        flex: 1,
        minHeight: 0,
    },
    roleTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    roleTitleShort: {
        fontSize: 20,
    },
    roleSubtitle: {
        fontSize: 16,
        color: '#64748b',
        marginBottom: 24,
        fontWeight: '500',
    },
    roleButtonContainer: {
        gap: 20,
    },
    roleButtonContainerShort: {
        gap: 16,
    },
    roleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    studentButton: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    teacherButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#4f46e5',
    },
    roleIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
    },
    teacherIconContainer: {
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
    },
    roleTextContainer: {
        flex: 1,
        marginRight: 16,
    },
    roleButtonTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 6,
        letterSpacing: -0.2,
    },
    teacherButtonTitle: {
        color: '#4f46e5',
    },
    roleButtonDescription: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.8)',
        lineHeight: 22,
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
        backgroundColor: 'rgba(79, 70, 229, 0.95)',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
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
    bottomPadding: {
        height: 20,
    },
});
