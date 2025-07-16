import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    ScrollView,
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

                    <Text style={styles.title}>Check Your Email</Text>
                    <Text style={styles.email}>{userEmail}</Text>

                    <View style={styles.mainCard}>
                        <View style={styles.mainIcon}>
                            <Ionicons name="mail" size={32} color="#4f46e5" />
                        </View>
                        <Text style={styles.mainText}>
                            Click the verification link in your email to continue
                        </Text>
                    </View>

                    <View style={styles.quickTip}>
                        <Ionicons name="bulb-outline" size={16} color="#f59e0b" />
                        <Text style={styles.quickTipText}>Check spam folder if you don't see it</Text>
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
                                <Text style={styles.secondaryButtonText}>Resend Email</Text>
                            </>
                        )}
                    </TouchableOpacity>
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
    mainCard: {
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
        alignItems: 'center',
    },
    mainIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    mainText: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
    },
    quickTip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        borderRadius: 12,
        padding: 12,
        marginTop: 16,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    quickTipText: {
        fontSize: 14,
        color: '#d97706',
        marginLeft: 8,
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