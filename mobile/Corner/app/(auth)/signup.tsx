import { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { signUp, signInWithGoogle } from './useAuth';
import { router } from 'expo-router';
import { auth } from '../../config/ firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/ firebase-config';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkGoogleSignIn = async () => {
            try {
                await GoogleSignin.hasPlayServices();
            } catch (error) {
                setError('Google Play Services not available');
            }
        };
        checkGoogleSignIn();
    }, []);

    const validatePassword = (password: string) => {
        const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
        return passwordRegex.test(password);
    };

    const handleSignup = async () => {
        if (!validatePassword(password)) {
            setError('Password must be at least 8 characters long and contain at least one number and one special character');
            return;
        }

        try {
            setLoading(true);
            const result = await signUp(email, password);
            await handleSuccessfulLogin(result.user);
        } catch (err: any) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            const result = await signInWithGoogle();

            if (!result) {
                router.replace('/role');
                return;
            }

            await handleSuccessfulLogin(result.user);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleSuccessfulLogin = async (user: any) => {
        try {
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
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join our learning community</Text>
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
                            placeholder="Create a password"
                            placeholderTextColor="#94a3b8"
                            onChangeText={setPassword}
                            value={password}
                            secureTextEntry
                        />
                    </View>
                </View>

                <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Confirm Password</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#4f46e5" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirm your password"
                            placeholderTextColor="#94a3b8"
                            onChangeText={setConfirmPassword}
                            value={confirmPassword}
                            secureTextEntry
                        />
                    </View>
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                    style={[styles.button, (!email || !password || !confirmPassword) && styles.buttonDisabled]}
                    onPress={handleSignup}
                    disabled={!email || !password || !confirmPassword || loading}
                >
                    <Text style={styles.buttonText}>{loading ? 'Creating Account...' : 'Create Account'}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>

                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleSignIn}
                    disabled={loading}
                >
                    <Ionicons name="logo-google" size={20} color="#4f46e5" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => router.replace('/(auth)/login')}
                >
                    <Text style={styles.linkText}>Already have an account? Sign in</Text>
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
