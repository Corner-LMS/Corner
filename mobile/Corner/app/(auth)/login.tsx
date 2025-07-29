import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Image, ScrollView, Alert, StatusBar } from 'react-native';
import { login, googleSignIn } from '../../services/authService';
import { router } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { getErrorGuidance } from '../../utils/errorHelpers';
import CustomAlert from '../../components/CustomAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { completeAuthFlow } from '../../utils/authUtils';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [errorGuidance, setErrorGuidance] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);

    // Optimize form validation with useCallback
    const validateForm = useCallback(() => {
        const valid = email.length > 0 && password.length >= 6;
        setIsFormValid(valid);
        return valid;
    }, [email, password]);

    // Debounced form validation
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            validateForm();
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [email, password, validateForm]);

    // Check if email is super admin - optimized with useCallback
    const checkSuperAdmin = useCallback((email: string) => {
        return email === 'corner.e.learning@gmail.com';
    }, []);

    useEffect(() => {
        const isAdmin = checkSuperAdmin(email);
        setIsSuperAdmin(isAdmin);
        if (isAdmin) {
            setError(null);
            setErrorGuidance(null);
        }
    }, [email, checkSuperAdmin]);

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
                <Text style={styles.title}>
                    {isSuperAdmin ? 'Super Admin Access' : 'Welcome Back'}
                </Text>
                <Text style={styles.subtitle}>
                    {isSuperAdmin
                        ? 'Access analytics and feedback data'
                        : 'Sign in to continue your learning journey'
                    }
                </Text>
            </View>
        );
    };

    const handleSuperAdminLogin = useCallback(async () => {
        if (!isFormValid) return;

        try {
            setLoading(true);
            setError(null);
            setErrorGuidance(null);

            // Pre-validate credentials
            if (!email || !password) {
                throw new Error('Please enter both email and password');
            }

            setAlertConfig({
                visible: true,
                title: 'Super Admin Access',
                message: 'Welcome! You are logging in as Super Admin. This gives you access to analytics and feedback data.',
                type: 'info',
                actions: [
                    {
                        text: 'Continue',
                        onPress: async () => {
                            setAlertConfig(null);
                            try {
                                // Use Firebase auth directly for super admin
                                const userCredential = await auth().signInWithEmailAndPassword(email, password);
                                const user = userCredential.user;

                                // Check if email is verified
                                if (!user.emailVerified) {
                                    await auth().signOut();
                                    throw new Error('Please verify your email before signing in.');
                                }

                                // Create or update super admin user document with optimized write
                                await firestore().collection('users').doc(user.uid).set({
                                    email: 'corner.e.learning@gmail.com',
                                    role: 'superadmin',
                                    name: 'Super Admin',
                                    createdAt: new Date(),
                                    isSuperAdmin: true,
                                    schoolId: null,
                                    lastLogin: new Date(),
                                }, { merge: true });

                                // Navigate to super admin dashboard
                                router.replace('/super-admin-dashboard');
                            } catch (error: any) {
                                console.error('Error in super admin login:', error);
                                const errorMessage = error.message || 'Failed to login as super admin. Please check your credentials.';
                                setError(errorMessage);
                            }
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
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : 'Super admin login failed';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [email, password, isFormValid]);

    const handleLogin = useCallback(async () => {
        if (!isFormValid) return;

        try {
            setLoading(true);
            setError(null);
            setErrorGuidance(null);

            // Pre-validate credentials
            if (!email || !password) {
                throw new Error('Please enter both email and password');
            }

            await login(email, password);
            await handleSuccessfulLogin();
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';

            // Handle unverified email specifically
            if (errorMessage.includes('verify your email') || errorMessage.includes('email not verified')) {
                setAlertConfig({
                    visible: true,
                    title: 'Email Not Verified',
                    message: 'Please check your email and click the verification link before signing in.',
                    type: 'warning',
                    actions: [
                        {
                            text: 'Go to Verification',
                            onPress: () => {
                                setAlertConfig(null);
                                // Sign in the user temporarily to access email verification screen
                                auth().signInWithEmailAndPassword(email, password).then(() => {
                                    router.replace('/(auth)/email-verification');
                                }).catch(() => {
                                    // If sign in fails, show error
                                    setError('Unable to access email verification. Please try again.');
                                });
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
            }
            // Handle missing role assignment
            else if (errorMessage.includes('not properly configured') || errorMessage.includes('assign your role')) {
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
            }
            // Handle missing school assignment
            else if (errorMessage.includes('not associated with any school')) {
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
            }
            // Handle missing user profile
            else if (errorMessage.includes('User profile not found')) {
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
            }
            // Use CustomAlert for critical errors, inline for form errors
            else if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('server')) {
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
            } else {
                setError(errorMessage);
                // Get error guidance for better user experience
                const guidance = getErrorGuidance(errorMessage);
                setErrorGuidance(guidance);
            }
        } finally {
            setLoading(false);
        }
    }, [email, password, isFormValid]);

    const handleGoogleSignIn = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setErrorGuidance(null);

            console.log('🔐 Starting Google Sign-In from login screen');
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
            case 'signup':
                router.replace('/(auth)/signup');
                break;
            case 'reset':
                router.push('/(auth)/reset-password');
                break;
            case 'resend':
                // This will be handled by the email verification screen
                break;
            default:
                break;
        }
    };

    const handleSuccessfulLogin = useCallback(async () => {
        try {
            const user = auth().currentUser;
            if (!user) return;

            // Check if email is verified for all users (including super admin)
            if (!user.emailVerified) {
                // Redirect to email verification screen
                router.replace('/(auth)/email-verification');
                return;
            }

            const userDoc = await firestore().collection('users').doc(user.uid).get();

            if (!userDoc.exists()) {
                // Check if this is super admin email - if so, create super admin user and go to dashboard
                if (user.email === 'corner.e.learning@gmail.com') {
                    await firestore().collection('users').doc(user.uid).set({
                        email: 'corner.e.learning@gmail.com',
                        role: 'superadmin',
                        name: 'Super Admin',
                        createdAt: new Date(),
                        isSuperAdmin: true,
                        lastLogin: new Date(),
                    });
                    router.replace('/super-admin-dashboard');
                    return;
                }
                // Normal user - go to role selection
                router.replace('/role');
                return;
            }

            const userData = userDoc.data();

            // Check if user is super admin
            if (userData?.role === 'superadmin' || userData?.isSuperAdmin === true) {
                // Navigate to super admin dashboard
                router.replace('/super-admin-dashboard');
                return;
            }

            // For normal users, check if they have role and school
            if (!userData?.role || !userData?.schoolId) {
                router.replace('/role');
                return;
            }

            // Route based on role for normal users
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Error in successful login:', error);
            router.replace('/role');
        }
    }, []);

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
                        onPress={() => router.replace('/welcome')}
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
                                emailFocused && styles.inputContainerFocused,
                                isSuperAdmin && styles.superAdminInput
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
                                        setError(null); // Clear error when user types
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
                                />
                            </View>
                        </View>

                        {!isSuperAdmin && (
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
                                        placeholder="Enter your password"
                                        placeholderTextColor="rgba(255, 255, 255, 0.6)" // More subtle placeholder
                                        onChangeText={(text) => {
                                            setPassword(text);
                                            setError(null); // Clear error when user types
                                            setErrorGuidance(null);
                                        }}
                                        value={password}
                                        secureTextEntry
                                        autoComplete="password"
                                        onFocus={() => setPasswordFocused(true)}
                                        onBlur={() => setPasswordFocused(false)}
                                        contextMenuHidden={true}
                                        selectionColor="rgba(255, 255, 255, 0.3)"
                                        cursorColor="rgba(255, 255, 255, 0.8)"
                                    />
                                </View>
                            </View>
                        )}

                        {isSuperAdmin && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Password</Text>
                                <View style={[
                                    styles.inputContainer,
                                    passwordFocused && styles.inputContainerFocused,
                                    styles.superAdminInput
                                ]}>
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={20}
                                        color={passwordFocused ? "#ffffff" : "#e0e7ff"}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your password"
                                        placeholderTextColor="rgba(255, 255, 255, 0.6)" // More subtle placeholder
                                        onChangeText={(text) => {
                                            setPassword(text);
                                            setError(null); // Clear error when user types
                                            setErrorGuidance(null);
                                        }}
                                        value={password}
                                        secureTextEntry
                                        autoComplete="password"
                                        onFocus={() => setPasswordFocused(true)}
                                        onBlur={() => setPasswordFocused(false)}
                                        contextMenuHidden={true}
                                        selectionColor="rgba(255, 255, 255, 0.3)"
                                        cursorColor="rgba(255, 255, 255, 0.8)"
                                    />
                                </View>
                            </View>
                        )}

                        {isSuperAdmin && (
                            <View style={styles.superAdminNotice}>
                                <Ionicons name="shield-checkmark" size={20} color="#fecaca" />
                                <Text style={styles.superAdminNoticeText}>
                                    Super Admin Access - Special privileges enabled
                                </Text>
                            </View>
                        )}

                        {isSuperAdmin && (
                            <TouchableOpacity
                                style={styles.forgotPasswordButton}
                                onPress={() => {
                                    setAlertConfig({
                                        visible: true,
                                        title: 'Reset Super Admin Password',
                                        message: 'A password reset link will be sent to corner.e.learning@gmail.com. Check your email and follow the instructions.',
                                        type: 'info',
                                        actions: [
                                            {
                                                text: 'Send Reset Link',
                                                onPress: async () => {
                                                    setAlertConfig(null);
                                                    try {
                                                        await auth().sendPasswordResetEmail('corner.e.learning@gmail.com');
                                                        setAlertConfig({
                                                            visible: true,
                                                            title: 'Reset Link Sent',
                                                            message: 'Check your email at corner.e.learning@gmail.com for password reset instructions.',
                                                            type: 'success',
                                                            actions: [
                                                                {
                                                                    text: 'OK',
                                                                    onPress: () => setAlertConfig(null),
                                                                    style: 'primary',
                                                                },
                                                            ],
                                                        });
                                                    } catch (error) {
                                                        console.error('Error sending reset email:', error);
                                                        setAlertConfig({
                                                            visible: true,
                                                            title: 'Error',
                                                            message: 'Failed to send reset email. Please try again.',
                                                            type: 'error',
                                                            actions: [
                                                                {
                                                                    text: 'OK',
                                                                    onPress: () => setAlertConfig(null),
                                                                    style: 'primary',
                                                                },
                                                            ],
                                                        });
                                                    }
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
                                }}
                            >
                                <Text style={styles.forgotPasswordText}>Forgot Super Admin Password?</Text>
                            </TouchableOpacity>
                        )}

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

                        {!isSuperAdmin && (
                            <TouchableOpacity
                                style={styles.forgotPasswordButton}
                                onPress={() => router.push('/(auth)/reset-password')}
                            >
                                <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
                            </TouchableOpacity>
                        )}

                        {isSuperAdmin ? (
                            <TouchableOpacity
                                style={[
                                    styles.superAdminButton,
                                    (!email || !password) && styles.primaryButtonDisabled
                                ]}
                                onPress={handleSuperAdminLogin}
                                disabled={!email || !password || loading}
                            >
                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        <Text style={styles.superAdminButtonText}>Signing in...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Ionicons name="shield-checkmark" size={20} color="#4f46e5" />
                                        <Text style={styles.superAdminButtonText}>Super Admin Sign In</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    (!email || !password) && styles.primaryButtonDisabled
                                ]}
                                onPress={handleLogin}
                                disabled={!email || !password || loading}
                            >
                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        <Text style={styles.primaryButtonText}>Signing in...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={styles.primaryButtonText}>Sign In</Text>
                                        <Ionicons name="arrow-forward" size={20} color="#4f46e5" />
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {!isSuperAdmin && (
                            <>
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
                            </>
                        )}
                    </View>

                    {!isSuperAdmin && (
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
                                <Text style={styles.footerLink}>Sign up</Text>
                            </TouchableOpacity>
                        </View>
                    )}
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
    textSection: {
        position: 'absolute',
        bottom: 40, // Reduced for better proportions
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    formSection: {
        // Removed flex: 1 and minHeight to prevent pushing footer down
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
        backgroundColor: 'rgba(255, 255, 255, 0.12)', // Slightly more opaque
        borderRadius: 20, // More rounded corners
        paddingHorizontal: 20,
        paddingVertical: 16, // Increased padding
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.15)',

    },
    inputContainerFocused: {
        borderColor: '#ffffff',
        backgroundColor: 'rgba(255, 255, 255, 0.18)', // More opaque when focused

    },
    superAdminInput: {
        borderColor: '#ffffff',
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
    },
    inputIcon: {
        marginRight: 16,
        opacity: 0.9, // Slightly more opaque
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
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 20, // Increased spacing
    },
    forgotPasswordText: {
        color: '#e0e7ff', // Light blue text
        fontSize: 14,
        fontWeight: '600',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff', // White button
        paddingVertical: 18, // Increased padding
        paddingHorizontal: 28, // Increased padding
        borderRadius: 16, // More rounded
        marginBottom: 20, // Increased spacing

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
    superAdminButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 18, // Increased padding
        paddingHorizontal: 28, // Increased padding
        borderRadius: 16, // More rounded
        marginBottom: 20, // Increased spacing

    },
    superAdminButtonText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
        letterSpacing: 0.3,
    },
    superAdminNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(220, 38, 38, 0.15)', // Slightly more opaque
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12, // More rounded
        marginBottom: 20, // Increased spacing
        borderWidth: 1,
        borderColor: 'rgba(220, 38, 38, 0.4)',
    },
    superAdminNoticeText: {
        color: '#fecaca', // Light red text
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
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
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.12)', // Slightly more opaque
        paddingVertical: 18, // Increased padding
        paddingHorizontal: 28, // Increased padding
        borderRadius: 16, // More rounded
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        marginBottom: 16, // Increased spacing

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
});


