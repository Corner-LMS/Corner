import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/ firebase-config';
import { sendVerificationEmail } from './useAuth';
import { onAuthStateChanged } from 'firebase/auth';

export default function EmailVerificationScreen() {
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserEmail(user.email || '');

                // If user is already verified, redirect to main app
                if (user.emailVerified) {
                    router.replace('/(tabs)');
                }
            } else {
                // No user signed in, redirect to login
                router.replace('/(auth)/login');
            }
        });

        return () => unsubscribe();
    }, []);

    const handleResendVerification = async () => {
        try {
            setResendLoading(true);
            await sendVerificationEmail();
            Alert.alert(
                'Verification Email Sent',
                'A new verification email has been sent to your inbox. Please check your email and click the verification link.',
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send verification email. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    const handleCheckVerification = async () => {
        try {
            setLoading(true);

            // Reload the user to get the latest verification status
            await auth.currentUser?.reload();

            if (auth.currentUser?.emailVerified) {
                Alert.alert(
                    'Email Verified!',
                    'Your email has been successfully verified. You can now sign in to your account.',
                    [
                        {
                            text: 'Continue to Login',
                            onPress: () => {
                                // Sign out the user and redirect to login
                                auth.signOut().then(() => {
                                    router.replace('/(auth)/login');
                                });
                            }
                        }
                    ]
                );
            } else {
                Alert.alert(
                    'Not Verified Yet',
                    'Your email has not been verified yet. Please check your inbox and click the verification link, then try again.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to check verification status. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await auth.signOut();
            router.replace('/(auth)/login');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to sign out. Please try again.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleSignOut}
                    >
                        <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                        <Text style={styles.backButtonText}>Back to Login</Text>
                    </TouchableOpacity>
                </View>

                {/* Main Content */}
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Image
                            source={require('../../assets/images/corner-splash-logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    <Text style={styles.title}>Verify Your Email</Text>
                    <Text style={styles.subtitle}>
                        We've sent a verification link to:
                    </Text>
                    <Text style={styles.email}>{userEmail}</Text>

                    <View style={styles.infoCard}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="mail-outline" size={24} color="#4f46e5" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>Check Your Inbox</Text>
                            <Text style={styles.infoText}>
                                Open the email we sent you and click the verification link to activate your account.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoCard}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="checkmark-circle-outline" size={24} color="#10b981" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>After Verification</Text>
                            <Text style={styles.infoText}>
                                Once verified, you can sign in to your account and start using Corner.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoCard}>
                        <View style={styles.infoIcon}>
                            <Ionicons name="refresh-outline" size={24} color="#f59e0b" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>Didn't Receive Email?</Text>
                            <Text style={styles.infoText}>
                                Check your spam folder or request a new verification email below.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.buttonDisabled]}
                        onPress={handleCheckVerification}
                        disabled={loading}
                    >
                        {loading ? (
                            <Text style={styles.primaryButtonText}>Checking...</Text>
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                <Text style={styles.primaryButtonText}>I've Verified My Email</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.secondaryButton, resendLoading && styles.buttonDisabled]}
                        onPress={handleResendVerification}
                        disabled={resendLoading}
                    >
                        {resendLoading ? (
                            <Text style={styles.secondaryButtonText}>Sending...</Text>
                        ) : (
                            <>
                                <Ionicons name="refresh" size={20} color="#4f46e5" />
                                <Text style={styles.secondaryButtonText}>Resend Verification Email</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
    },
    header: {
        paddingTop: 10,
        paddingBottom: 20,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        padding: 12,
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
        marginLeft: 8,
        letterSpacing: 0.3,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 20,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 20,
        backgroundColor: '#f0f4ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e0e7ff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    logo: {
        width: 80,
        height: 80,
        borderRadius: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: '500',
    },
    email: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4f46e5',
        textAlign: 'center',
        marginBottom: 32,
        backgroundColor: '#f0f4ff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e7ff',
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    infoIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    infoContent: {
        flex: 1,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        fontWeight: '500',
    },
    actions: {
        paddingVertical: 20,
        gap: 16,
    },
    primaryButton: {
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
    secondaryButton: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderWidth: 2,
        borderColor: '#4f46e5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    secondaryButtonText: {
        color: '#4f46e5',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
}); 