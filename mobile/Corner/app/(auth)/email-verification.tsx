import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import { sendVerificationEmail } from '../../services/authService';
import CustomAlert from '../../components/CustomAlert';

export default function EmailVerificationScreen() {
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        title: '',
        message: '',
        type: 'info' as 'info' | 'warning' | 'error' | 'success' | 'confirm',
        actions: [] as any[]
    });

    useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged(async (user) => {
            if (user) {
                setUserEmail(user.email || '');

                if (user.emailVerified) {
                    // Check if user is super admin
                    if (user.email === 'corner.e.learning@gmail.com') {
                        // Create super admin user document if it doesn't exist
                        const userDoc = await firestore().collection('users').doc(user.uid).get();
                        if (!userDoc.exists()) {
                            await firestore().collection('users').doc(user.uid).set({
                                email: 'corner.e.learning@gmail.com',
                                role: 'superadmin',
                                name: 'Super Admin',
                                createdAt: new Date(),
                                isSuperAdmin: true
                            });
                        }
                        router.replace('/super-admin-dashboard');
                    } else {
                        router.replace('/(tabs)');
                    }
                }
            } else {
                router.replace('/(auth)/login');
            }
        });

        return () => unsubscribe();
    }, []);

    const showAlert = (title: string, message: string, type: 'info' | 'warning' | 'error' | 'success' | 'confirm', actions: any[]) => {
        setAlertConfig({ title, message, type, actions });
        setAlertVisible(true);
    };

    const handleResendVerification = async () => {
        try {
            setResendLoading(true);
            await sendVerificationEmail();
            showAlert(
                'Email Sent!',
                'Check your inbox and click the verification link.',
                'success',
                [{ text: 'OK', onPress: () => { }, style: 'primary' }]
            );
        } catch (error: any) {
            showAlert(
                'Error',
                error.message || 'Failed to send verification email.',
                'error',
                [{ text: 'OK', onPress: () => { }, style: 'default' }]
            );
        } finally {
            setResendLoading(false);
        }
    };

    const handleCheckVerification = async () => {
        try {
            setLoading(true);

            await auth().currentUser?.reload();

            if (auth().currentUser?.emailVerified) {
                // Check if user is super admin
                const user = auth().currentUser;
                if (user && user.email === 'corner.e.learning@gmail.com') {
                    // Create super admin user document if it doesn't exist
                    const userDoc = await firestore().collection('users').doc(user.uid).get();
                    if (!userDoc.exists()) {
                        await firestore().collection('users').doc(user.uid).set({
                            email: 'corner.e.learning@gmail.com',
                            role: 'superadmin',
                            name: 'Super Admin',
                            createdAt: new Date(),
                            isSuperAdmin: true
                        });
                    }

                    showAlert(
                        'Welcome!',
                        'Email verified. Going to Super Admin Dashboard.',
                        'success',
                        [{
                            text: 'Continue',
                            onPress: () => router.replace('/super-admin-dashboard'),
                            style: 'primary'
                        }]
                    );
                } else {
                    // Normal user - go to role selection
                    showAlert(
                        'Success!',
                        'Email verified. Let\'s set up your profile.',
                        'success',
                        [{
                            text: 'Continue',
                            onPress: () => router.replace('/role'),
                            style: 'primary'
                        }]
                    );
                }
            } else {
                showAlert(
                    'Not Verified',
                    'Click the link in your email, then try again.',
                    'warning',
                    [{ text: 'OK', onPress: () => { }, style: 'default' }]
                );
            }
        } catch (error: any) {
            showAlert(
                'Error',
                error.message || 'Failed to check verification.',
                'error',
                [{ text: 'OK', onPress: () => { }, style: 'default' }]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await auth().signOut();
            router.replace('/(auth)/login');
        } catch (error: any) {
            showAlert(
                'Error',
                error.message || 'Failed to sign out.',
                'error',
                [{ text: 'OK', onPress: () => { }, style: 'default' }]
            );
        }
    };

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

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Logo Background Section */}
                <View style={styles.logoBackgroundSection}>
                    {renderLogoSection()}
                </View>

                {/* Main Content */}
                <View style={styles.content}>
                    <Text style={styles.title}>Check Your Email</Text>
                    <Text style={styles.email}>{userEmail}</Text>

                    <View style={styles.mainCard}>
                        <View style={styles.mainIcon}>
                            <Ionicons name="mail" size={48} color="#4f46e5" />
                        </View>
                        <Text style={styles.mainTitle}>Verify Your Email</Text>
                        <Text style={styles.mainDescription}>
                            We've sent a verification link to your email address. Click the link to verify your account and continue.
                        </Text>

                        {/* Spam folder notice */}
                        <View style={styles.spamNotice}>
                            <Ionicons name="warning" size={16} color="#f59e0b" />
                            <Text style={styles.spamNoticeText}>
                                Can't find the email? Check your spam/junk folder - verification emails are sometimes flagged as spam during testing.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleCheckVerification}
                            disabled={loading}
                        >
                            {loading ? (
                                <Text style={styles.primaryButtonText}>Checking...</Text>
                            ) : (
                                <>
                                    <Text style={styles.primaryButtonText}>I've Verified My Email</Text>
                                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleResendVerification}
                            disabled={resendLoading}
                        >
                            {resendLoading ? (
                                <Text style={styles.secondaryButtonText}>Sending...</Text>
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={16} color="#4f46e5" />
                                    <Text style={styles.secondaryButtonText}>Resend Email</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={handleSignOut}
                        >
                            <Ionicons name="arrow-back" size={16} color="#64748b" />
                            <Text style={styles.backButtonText}>Back to Login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <CustomAlert
                visible={alertVisible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                actions={alertConfig.actions}
                onDismiss={() => setAlertVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
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
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    email: {
        fontSize: 16,
        color: '#4f46e5',
        textAlign: 'center',
        marginBottom: 32,
        fontWeight: '600',
    },
    mainCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 32,
        marginBottom: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    mainIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    mainTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    mainDescription: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500',
    },
    spamNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 24,
        gap: 8,
    },
    spamNoticeText: {
        fontSize: 14,
        color: '#f59e0b',
        fontWeight: '600',
        lineHeight: 20,
    },
    actionButtons: {
        gap: 16,
        marginBottom: 32,
    },
    primaryButton: {
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
    primaryButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
        gap: 8,
    },
    secondaryButtonText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    footer: {
        alignItems: 'center',
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    backButtonText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: '600',
    },
}); 