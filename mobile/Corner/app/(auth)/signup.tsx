import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Image, ScrollView, Alert, StatusBar } from 'react-native';
import { signUp, googleSignIn } from '../../services/authService';
import { router } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { getErrorGuidance } from '../../utils/errorHelpers';
import CustomAlert from '../../components/CustomAlert';
import { completeAuthFlow } from '../../utils/authUtils';

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
    const [isFormValid, setIsFormValid] = useState(false);

    // Optimize form validation with useCallback
    const validateForm = useCallback(() => {
        const valid = email.length > 0 &&
            password.length >= 6 &&
            password === confirmPassword &&
            email.includes('@');
        setIsFormValid(valid);
        return valid;
    }, [email, password, confirmPassword]);

    // Debounced form validation
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            validateForm();
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [email, password, confirmPassword, validateForm]);

    const renderLogoSection = () => {
        return (
            <View style={styles.logoSection}>
                <View style={styles.logoIconContainer}>
                    <Text style={styles.logoIconText}>C</Text>
                </View>
            </View>
        );
    };

    const renderTextSection = () => {
        return (
            <View style={styles.textSection}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join Corner to start your learning journey</Text>
            </View>
        );
    };

    const handleSignup = useCallback(async () => {
        if (!isFormValid) return;

        try {
            setLoading(true);
            setError(null);
            setErrorGuidance(null);

            // Pre-validate form
            if (!email || !password || !confirmPassword) {
                throw new Error('Please fill in all fields');
            }

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

            // Validate email format
            if (!email.includes('@')) {
                setError('Please enter a valid email address');
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
                    message: 'An account with this email already exists. Would you like to sign in instead?',
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
                            text: 'Try Different Email',
                            onPress: () => {
                                setAlertConfig(null);
                                setEmail('');
                                setPassword('');
                                setConfirmPassword('');
                            },
                            style: 'secondary',
                        },
                        {
                            text: 'Cancel',
                            onPress: () => setAlertConfig(null),
                            style: 'cancel',
                        },
                    ],
                });
            } else if (errorMessage.includes('not properly configured') || errorMessage.includes('assign your role')) {
                setAlertConfig({
                    visible: true,
                    title: 'Complete Your Account Setup',
                    message: 'Your account needs to be configured with a role and school. We\'ll redirect you to the setup screen to complete this process.',
                    type: 'info',
                    actions: [
                        {
                            text: 'Complete Setup',
                            onPress: () => {
                                setAlertConfig(null);
                                router.replace('/role');
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
            } else if (errorMessage.includes('not associated with any school')) {
                setAlertConfig({
                    visible: true,
                    title: 'Complete Your Account Setup',
                    message: 'Your account needs to be associated with a school. We\'ll redirect you to the setup screen to complete this process.',
                    type: 'info',
                    actions: [
                        {
                            text: 'Complete Setup',
                            onPress: () => {
                                setAlertConfig(null);
                                router.replace('/role');
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
            } else if (errorMessage.includes('User profile not found')) {
                setAlertConfig({
                    visible: true,
                    title: 'Complete Your Account Setup',
                    message: 'Your user profile needs to be set up. We\'ll redirect you to the setup screen to complete this process.',
                    type: 'info',
                    actions: [
                        {
                            text: 'Complete Setup',
                            onPress: () => {
                                setAlertConfig(null);
                                router.replace('/role');
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
    }, [email, password, confirmPassword, isFormValid]);

    const handleGoogleSignIn = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setErrorGuidance(null);

            console.log('🔐 Starting Google Sign-In from signup screen');
            const result = await googleSignIn();

            // Check if user needs setup
            if (result.needsSetup) {
                console.log('📝 User needs setup, redirecting to role selection');
                router.replace('/role');
                return;
            }

            // Use the new auth flow utility for users with complete profiles
            const authResult = await completeAuthFlow();
            console.log('✅ Auth flow completed successfully');

            if (authResult.hasCompleteProfile) {
                // User has role and school, redirect to main app
                console.log('✅ User has complete profile, redirecting to main app');
                router.replace('/(tabs)');
            } else {
                // User needs to set role and school
                console.log('📝 User needs role selection, redirecting to role screen');
                router.replace('/role');
            }
        } catch (error: any) {
            console.error('❌ Google Sign-In error:', error);
            setLoading(false);

            // Handle specific error cases
            if (error.message === 'Auth state timeout') {
                setError('Sign-in is taking longer than expected. Please try again.');
                setErrorGuidance('This might be due to a slow network connection.');
            } else if (error.message === 'No user found') {
                setError('Google Sign-In completed but authentication failed. Please try again.');
                setErrorGuidance('This might be due to a network issue or Firebase configuration problem.');
            } else if (error.message === 'Authentication lost during token refresh') {
                setError('Your authentication session was lost. Please try signing in again.');
                setErrorGuidance('This might be due to a network interruption during sign-in.');
            } else {
                setError('Google Sign-In failed. Please try again.');
                setErrorGuidance('Check your internet connection and try again.');
            }
        }
    }, []);

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

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" translucent={true} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Back Button */}
                <View style={styles.backButtonContainer}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.replace('/(auth)/login')}
                    >
                        <Ionicons name="arrow-back" size={24} color="#ffffff" />
                    </TouchableOpacity>
                </View>

                {/* Logo Section with Background */}
                <View style={styles.logoBackgroundSection}>
                    {renderLogoSection()}
                    {renderTextSection()}
                </View>

                {/* Text Section */}
                {/* Removed - now overlaid on logo section */}

                <View style={styles.content}>
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
                                    color={emailFocused ? "#ffffff" : "#e0e7ff"}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor="rgba(255, 255, 255, 0.6)" // More subtle placeholder
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
                                    contextMenuHidden={true}
                                    selectionColor="rgba(255, 255, 255, 0.3)"
                                    cursorColor="rgba(255, 255, 255, 0.8)"
                                    autoCorrect={false}
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
                                    color={passwordFocused ? "#ffffff" : "#e0e7ff"}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Create a password"
                                    placeholderTextColor="rgba(255, 255, 255, 0.6)" // More subtle placeholder
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
                                    contextMenuHidden={true}
                                    selectionColor="rgba(255, 255, 255, 0.3)"
                                    cursorColor="rgba(255, 255, 255, 0.8)"
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
                                    color={confirmPasswordFocused ? "#ffffff" : "#e0e7ff"}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm your password"
                                    placeholderTextColor="rgba(255, 255, 255, 0.6)" // More subtle placeholder
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
                                    contextMenuHidden={true}
                                    selectionColor="rgba(255, 255, 255, 0.3)"
                                    cursorColor="rgba(255, 255, 255, 0.8)"
                                />
                            </View>
                        </View>

                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle-outline" size={16} color="#fecaca" />
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
                                    <Ionicons name="arrow-forward" size={20} color="#4f46e5" />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.divider} />
                        </View>

                        <TouchableOpacity
                            style={styles.Button}
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
        backgroundColor: '#4f46e5', // Full indigo background
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: Platform.OS === 'ios' ? 60 : 40, // Increased padding for better spacing
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    backButtonContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 80 : 60,
        left: 24,
        zIndex: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle background
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        flexDirection: 'column',
        backgroundColor: '#4f46e5', // Indigo background
    },
    logoSection: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        backgroundColor: 'transparent', // Remove any background
    },
    logoIconContainer: {
        width: Platform.OS === 'ios' ? 96 : 80, // Responsive size
        height: Platform.OS === 'ios' ? 96 : 80,
        borderRadius: Platform.OS === 'ios' ? 48 : 40, // Perfect circle
        backgroundColor: '#4f46e5', // bg-indigo-600
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
        marginBottom: 40, // Reduced space for better proportions
    },
    logoIconText: {
        fontSize: Platform.OS === 'ios' ? 50 : 42, // Responsive font size
        fontWeight: '800', // font-extrabold
        color: '#ffffff', // text-white
        fontFamily: 'Georgia',
        letterSpacing: 4, // tracking-widest equivalent
    },
    title: {
        fontSize: Platform.OS === 'ios' ? 32 : 28, // Responsive font size
        fontWeight: '700',
        color: '#ffffff', // White text on indigo
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: Platform.OS === 'ios' ? 16 : 14, // Responsive font size
        color: '#e0e7ff', // Light blue text on indigo
        textAlign: 'center',
        lineHeight: Platform.OS === 'ios' ? 22 : 20,
        fontWeight: '400',
        maxWidth: 280,
    },
    formSection: {
        width: '100%',
        paddingTop: 20, // Add some spacing from logo section
    },
    inputGroup: {
        marginBottom: 16, // Increased spacing
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff', // White labels
        marginBottom: 8, // Increased spacing
        letterSpacing: 0.3,
    },
    inputContainer: {

        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)', // Semi-transparent white
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)',

    },
    inputContainerFocused: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderColor: 'white',

    },
    inputIcon: {
        marginRight: 16,
        opacity: 0.9,
    },
    input: {

        flex: 1,
        fontSize: 16,
        color: '#ffffff', // White text
        padding: 0,
        fontWeight: '500',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(239, 68, 68, 0.15)', // Slightly more opaque
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12, // More rounded
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    errorContent: {
        flex: 1,
        marginLeft: 8, // Increased spacing
    },
    errorText: {
        color: '#fecaca', // Light red text
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
        marginBottom: 6, // Increased spacing
    },
    errorActionButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8, // More rounded
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    errorActionText: {
        color: '#4f46e5', // Indigo text on white button
        fontSize: 12,
        fontWeight: '600',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff', // White button
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginBottom: 16,
    },
    primaryButtonDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)', // Less opaque when disabled
        shadowOpacity: 0.1,
    },
    primaryButtonText: {
        color: '#4f46e5', // Indigo text on white button
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
        marginBottom: 20, // Increased spacing
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.25)', // Slightly more opaque
    },
    dividerText: {
        color: '#e0e7ff', // Light blue text
        fontSize: 14,
        fontWeight: '600',
        marginHorizontal: 16, // Increased spacing
    },
    Button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.12)', // Slightly more opaque
        paddingVertical: 18, // Increased padding
        paddingHorizontal: 28, // Increased padding
        borderRadius: 16, // More rounded
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        marginBottom: 16, // Increased spacing
        // shadowColor: '#000',
        // shadowOffset: { width: 0, height: 4 },
        // shadowOpacity: 0.15,
        // shadowRadius: 12,
        // elevation: 4,
    },
    googleIcon: {
        width: 20,
        height: 20,
        marginRight: 12,
    },
    googleButtonText: {
        color: '#ffffff', // White text
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20, // Increased padding
        paddingBottom: Platform.OS === 'ios' ? 40 : 30, // Increased bottom padding
        marginTop: 20, // Add top margin for separation
    },
    footerText: {
        color: '#e0e7ff', // Light blue text
        fontSize: 15,
        fontWeight: '400',
    },
    footerLink: {
        color: '#ffffff', // White text
        fontSize: 15,
        fontWeight: '600',
    },
    logoBackgroundSection: {
        width: '100%',
        height: Platform.OS === 'ios' ? 320 : 280, // Responsive height
        backgroundColor: '#4f46e5',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
        paddingBottom: 20,
        position: 'relative', // For absolute positioning of text
    },
    textSection: {
        position: 'absolute',
        bottom: 40, // Reduced for better proportions
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
}); 