import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert, Image, ScrollView } from 'react-native';
import { signUp } from './useAuth';
import { router } from 'expo-router';
import { auth } from '../../config/ firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/ firebase-config';
import { Ionicons } from '@expo/vector-icons';
import { getErrorGuidance, getPasswordStrengthMessage, getPasswordStrengthColor } from '../../utils/errorHelpers';
// import { GoogleSignin } from '@react-native-google-signin/google-signin';

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

    // useEffect(() => {
    //     const checkGoogleSignIn = async () => {
    //         try {
    //             await GoogleSignin.hasPlayServices();
    //         } catch (error) {
    //             setError('Google Play Services not available');
    //         }
    //     };
    //     checkGoogleSignIn();
    // }, []);

    const validatePassword = (password: string) => {
        const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
        return passwordRegex.test(password);
    };

    const handleSignup = async () => {
        if (!validatePassword(password)) {
            setError('Password must be at least 8 characters long and contain at least one number and one special character');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match. Please make sure both passwords are identical.');
            return;
        }

        try {
            setLoading(true);
            setError(null); // Clear previous errors
            setErrorGuidance(null);
            const result = await signUp(email, password);
            await handleSuccessfulLogin(result.user);
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);

            // Get error guidance for better user experience
            const guidance = getErrorGuidance(errorMessage);
            setErrorGuidance(guidance);
        } finally {
            setLoading(false);
        }
    };

    const handleErrorAction = (action: string) => {
        switch (action) {
            case 'login':
                router.replace('/(auth)/login');
                break;
            default:
                break;
        }
    };

    // const handleGoogleSignIn = async () => {
    //     try {
    //         const result = await signInWithGoogle();

    //         if (!result) {
    //             router.replace('/role');
    //             return;
    //         }

    //         await handleSuccessfulLogin(result.user);
    //     } catch (error: any) {
    //         Alert.alert('Error', error.message);
    //     }
    // };

    const handleSuccessfulLogin = async (user: any) => {
        try {
            // Check if email is verified
            if (!user.emailVerified) {
                // Redirect to email verification screen
                router.replace('/(auth)/email-verification');
                return;
            }

            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (!userDoc.exists()) {
                router.replace('/role');
                return;
            }

            const userData = userDoc.data();

            if (!userData.role || !userData.schoolId) {
                router.replace('/role');
                return;
            }

            if (userData.role === 'admin') {
                router.replace('/(tabs)');
            } else if (userData.role === 'teacher') {
                router.replace('/(tabs)');
            } else if (userData.role === 'student') {
                router.replace('/(tabs)');
            } else {
                router.replace('/role');
            }
        } catch (error) {
            router.replace('/role');
        }
    };

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
                        onPress={() => router.replace('/welcome')}
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
                        <Text style={styles.subtitle}>Join our learning community and start your journey</Text>
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
                                        setError(null); // Clear error when user types
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
                                    placeholder="Create a strong password"
                                    placeholderTextColor="#94a3b8"
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        setError(null); // Clear error when user types
                                        setErrorGuidance(null);
                                    }}
                                    value={password}
                                    secureTextEntry
                                    autoComplete="new-password"
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                />
                            </View>
                            <Text style={[
                                styles.passwordHint,
                                { color: getPasswordStrengthColor(password) }
                            ]}>
                                {getPasswordStrengthMessage(password)}
                            </Text>
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
                                        setError(null); // Clear error when user types
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
                                (!email || !password || !confirmPassword) && styles.primaryButtonDisabled
                            ]}
                            onPress={handleSignup}
                            disabled={!email || !password || !confirmPassword || loading}
                        >
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.primaryButtonText}>Creating Account...</Text>
                                </View>
                            ) : (
                                <>
                                    <Text style={styles.primaryButtonText}>Create Account</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                                </>
                            )}
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
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: 40,
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
        flex: 1,
        minHeight: 500,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
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
    passwordHint: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 6,
        marginLeft: 4,
        fontWeight: '400',
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
        marginBottom: 24,
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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


