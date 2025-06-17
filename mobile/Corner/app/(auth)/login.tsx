import { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { login, signInWithGoogle } from './useAuth';
import { router } from 'expo-router';
import { auth } from '../../config/ firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/ firebase-config';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        console.log('=== LOGIN SCREEN MOUNTED ===');
        // Verify Google Sign-In configuration
        const checkGoogleSignIn = async () => {
            try {
                const isConfigured = await GoogleSignin.hasPlayServices();
                console.log('Google Play Services available:', isConfigured);
            } catch (error) {
                console.error('Google Play Services check failed:', error);
            }
        };
        checkGoogleSignIn();
    }, []);

    const handleLogin = async () => {
        try {
            setLoading(true);
            await login(email, password);
            await handleSuccessfulLogin();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const startSignInFlow = async () => {
        try {
            console.log('=== STARTING GOOGLE SIGN-IN FLOW ===');
            setLoading(true);

            console.log('Checking Play Services...');
            await GoogleSignin.hasPlayServices();
            console.log('Play Services check passed');

            console.log('Initiating Google Sign-In...');
            const userInfo = await GoogleSignin.signIn();
            console.log('Google Sign-In successful, user info:', JSON.stringify(userInfo, null, 2));

            console.log('Proceeding with successful login...');
            await handleSuccessfulLogin();
            console.log('Login flow completed successfully');
        } catch (err: any) {
            console.error('Detailed Google Sign-In Error:', {
                name: err?.name,
                message: err?.message,
                code: err?.code,
                stack: err?.stack,
                fullError: JSON.stringify(err, null, 2)
            });
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleSuccessfulLogin = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            throw new Error('User not found');
        }
        // fetch role from Firestore
        const userDoc = await getDoc(doc(db, "users", userId));
        const userData = userDoc.data();
        if (!userData) {
            throw new Error('User data not found');
        }
        const role = userData.role;
        if (role === 'student') {
            router.replace('/');
        } else if (role === 'teacher' || role === 'admin') {
            router.replace('/(tabs)');
        } else {
            router.replace('/');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <Pressable
                style={styles.backButton}
                onPress={() => router.replace('/welcome')}
            >
                <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <View style={styles.formContainer}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="school-outline" size={48} color="#4f46e5" />
                    </View>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to continue learning</Text>
                </View>

                <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color="#4f46e5" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#94a3b8"
                            onChangeText={setEmail}
                            value={email}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>
                </View>

                <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#4f46e5" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor="#94a3b8"
                            onChangeText={setPassword}
                            value={password}
                            secureTextEntry
                        />
                    </View>
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    onPress={() => router.push('/(auth)/reset-password')}
                >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, (!email || !password) && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={!email || !password || loading}
                >
                    <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                    style={styles.googleButton}
                    onPress={startSignInFlow}
                    disabled={loading}
                >
                    <Ionicons name="logo-google" size={20} color="#4f46e5" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => router.replace('/(auth)/signup')}
                >
                    <Text style={styles.linkText}>Don't have an account? Sign up</Text>
                </TouchableOpacity>
            </View>
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
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        zIndex: 1,
    },
    backButtonText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    formContainer: {
        flex: 1,
        padding: 32,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 17,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500',
    },
    inputSection: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1e293b',
        padding: 0,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
        fontWeight: '500',
    },
    forgotPasswordButton: {
        alignSelf: 'flex-end',
        marginBottom: 32,
    },
    forgotPasswordText: {
        color: '#4f46e5',
        fontSize: 15,
        fontWeight: '600',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4f46e5',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        marginBottom: 24,
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
        marginRight: 8,
        letterSpacing: 0.3,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    dividerText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '500',
        marginHorizontal: 16,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    googleButtonText: {
        color: '#1e293b',
        fontSize: 17,
        fontWeight: '600',
        marginLeft: 12,
        letterSpacing: 0.3,
    },
    linkButton: {
        alignItems: 'center',
    },
    linkText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '600',
    },
});
