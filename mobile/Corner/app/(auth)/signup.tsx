import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Image, ScrollView, Alert } from 'react-native';
import { signUp, googleSignIn } from '../../services/authService';
import { router } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { getErrorGuidance } from '../../utils/errorHelpers';
import CustomAlert from '../../components/CustomAlert';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [errorGuidance, setErrorGuidance] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>(null);

    const handleSignup = async () => {
        try {
            setLoading(true);
            setError(null);
            setErrorGuidance(null);

            // Validate passwords match
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }

            // Validate password length
            if (password.length < 6) {
                setError('Password must be at least 6 characters long');
                return;
            }

            await signUp(email, password);

            // Show success message before redirecting
            setAlertConfig({
                visible: true,
                title: 'Account Created!',
                message: 'Your account has been created successfully. Please check your email to verify your account.',
                type: 'success',
                actions: [
                    {
                        text: 'OK',
                        onPress: () => {
                            setAlertConfig(null);
                            router.replace('/(auth)/email-verification');
                        },
                        style: 'primary',
                    },
                ],
            });
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';

            // Use CustomAlert for critical errors, inline for form errors
            if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('server')) {
                setAlertConfig({
                    visible: true,
                    title: 'Connection Error',
                    message: 'Unable to connect to our servers. Please check your internet connection and try again.',
                    type: 'error',
                    actions: [
                        {
                            text: 'OK',
                            onPress: () => setAlertConfig(null),
                            style: 'primary',
                        },
                    ],
                });
            } else if (errorMessage.includes('email-already-in-use')) {
                setAlertConfig({
                    visible: true,
                    title: 'Account Already Exists',
                    message: 'An account with this email already exists. Please try signing in instead.',
                    type: 'warning',
                    actions: [
                        {
                            text: 'Sign In',
                            onPress: () => {
                                setAlertConfig(null);
                                router.replace('/(auth)/login');
                            },
                            style: 'primary',
                        },
                        {
                            text: 'Cancel',
                            onPress: () => setAlertConfig(null),
                            style: 'cancel',
                        },
                    ],
                });
            } else {
                setError(errorMessage);
                // Get error guidance for better user experience
                const guidance = getErrorGuidance(errorMessage);
                setErrorGuidance(guidance);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            setError(null);
            setErrorGuidance(null);
            await googleSignIn();

            // Wait a bit for auth state to settle, then check and navigate
            setTimeout(async () => {
                const user = auth().currentUser;
                if (user) {
                    const userDoc = await firestore().collection('users').doc(user.uid).get();
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData?.role && userData?.schoolId) {
                            // User has role and school, redirect to main app
                            router.replace('/(tabs)');
                        } else {
                            // User needs to set role and school
                            router.replace('/role');
                        }
                    } else {
                        // User document doesn't exist (shouldn't happen with Google Sign-In)
                        router.replace('/role');
                    }
                } else {
                    // No user (shouldn't happen after successful Google Sign-In)
                    router.replace('/role');
                }
            }, 1000); // 1 second delay to let auth state settle
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : 'Google Sign-In failed';

            // Use CustomAlert for Google Sign-In errors
            setAlertConfig({
                visible: true,
                title: 'Google Sign-In Failed',
                message: 'Unable to sign in with Google. Please try again or create an account with email and password.',
                type: 'error',
                actions: [
                    {
                        text: 'Try Again',
                        onPress: () => {
                            setAlertConfig(null);
                            handleGoogleSignIn();
                        },
                        style: 'primary',
                    },
                    {
                        text: 'Cancel',
                        onPress: () => setAlertConfig(null),
                        style: 'cancel',
                    },
                ],
            });
        } finally {
            setLoading(false);
        }
    };

    const handleErrorAction = (action: string) => {
        switch (action) {
            case 'login':
                router.replace('/(auth)/login');
                break;
            case 'reset':
                router.push('/(auth)/reset-password');
                break;
            default:
                break;
        }
    };

    const isFormValid = email && password && confirmPassword && password === confirmPassword && password.length >= 6;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.replace('/(auth)/login')}
                    >
                        <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <View style={styles.logoSection}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={require('../../assets/images/corner-splash-logo.png')}
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Join Corner to start your learning journey</Text>
                    </View>

                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Email Address</Text>
                            <View style={[
                                styles.inputContainer,
                                emailFocused && styles.inputContainerFocused
                            ]}>
                                <Ionicons
                                    name="mail-outline"
                                    size={20}
                                    color={emailFocused ? "#4f46e5" : "#64748b"}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#94a3b8"
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        setError(null);
                                        setErrorGuidance(null);
                                    }}
                                    value={email}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoComplete="email"
                                    onFocus={() => setEmailFocused(true)}
                                    onBlur={() => setEmailFocused(false)}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <View style={[
                                styles.inputContainer,
                                passwordFocused && styles.inputContainerFocused
                            ]}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={20}
                                    color={passwordFocused ? "#4f46e5" : "#64748b"}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Create a password"
                                    placeholderTextColor="#94a3b8"
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        setError(null);
                                        setErrorGuidance(null);
                                    }}
                                    value={password}
                                    secureTextEntry
                                    autoComplete="new-password"
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Confirm Password</Text>
                            <View style={[
                                styles.inputContainer,
                                confirmPasswordFocused && styles.inputContainerFocused
                            ]}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={20}
                                    color={confirmPasswordFocused ? "#4f46e5" : "#64748b"}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm your password"
                                    placeholderTextColor="#94a3b8"
                                    onChangeText={(text) => {
                                        setConfirmPassword(text);
                                        setError(null);
                                        setErrorGuidance(null);
                                    }}
                                    value={confirmPassword}
                                    secureTextEntry
                                    autoComplete="new-password"
                                    onFocus={() => setConfirmPasswordFocused(true)}
                                    onBlur={() => setConfirmPasswordFocused(false)}
                                />
                            </View>
                        </View>

                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                                <View style={styles.errorContent}>
                                    <Text style={styles.errorText}>{error}</Text>
                                    {errorGuidance?.showAction && (
                                        <TouchableOpacity
                                            style={styles.errorActionButton}
                                            onPress={() => handleErrorAction(errorGuidance.action)}
                                        >
                                            <Text style={styles.errorActionText}>{errorGuidance.actionText}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                !isFormValid && styles.primaryButtonDisabled
                            ]}
                            onPress={handleSignup}
                            disabled={!isFormValid || loading}
                        >
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.primaryButtonText}>Creating account...</Text>
                                </View>
                            ) : (
                                <>
                                    <Text style={styles.primaryButtonText}>Create Account</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.divider} />
                        </View>

                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={handleGoogleSignIn}
                            disabled={loading}
                        >
                            <Image
                                source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                                style={styles.googleIcon}
                            />
                            <Text style={styles.googleButtonText}>Continue with Google</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                            <Text style={styles.footerLink}>Sign in</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <CustomAlert
                visible={alertConfig?.visible || false}
                title={alertConfig?.title || ''}
                message={alertConfig?.message || ''}
                type={alertConfig?.type || 'info'}
                actions={alertConfig?.actions || []}
                onDismiss={() => setAlertConfig(null)}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        flexDirection: 'column',
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 20,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 20,
        backgroundColor: '#f0f4ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e0e7ff',
    },
    logoImage: {
        width: 80,
        height: 80,
        borderRadius: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '400',
        maxWidth: 280,
    },
    formSection: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
        letterSpacing: 0.3,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    inputContainerFocused: {
        borderColor: '#4f46e5',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    inputIcon: {
        marginRight: 16,
        opacity: 0.7,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1f2937',
        padding: 0,
        fontWeight: '500',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#fef2f2',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    errorContent: {
        flex: 1,
        marginLeft: 6,
    },
    errorText: {
        color: '#dc2626',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
        marginBottom: 4,
    },
    errorActionButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#4f46e5',
    },
    errorActionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4f46e5',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 4,
    },
    primaryButtonDisabled: {
        backgroundColor: '#9ca3af',
        shadowOpacity: 0.1,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
        letterSpacing: 0.3,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    dividerText: {
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '600',
        marginHorizontal: 12,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginBottom: 12,
    },
    googleIcon: {
        width: 20,
        height: 20,
        marginRight: 12,
    },
    googleButtonText: {
        color: '#1f2937',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    },
    footerText: {
        color: '#6b7280',
        fontSize: 15,
        fontWeight: '400',
    },
    footerLink: {
        color: '#4f46e5',
        fontSize: 15,
        fontWeight: '600',
    },
}); 