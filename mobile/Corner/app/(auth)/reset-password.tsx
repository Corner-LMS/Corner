import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { resetPassword } from './useAuth';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ResetPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleResetPassword = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address.');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(email.trim());
            setSuccess(true);
            Alert.alert(
                'Email Sent',
                'A password reset link has been sent to your email address. Please check your inbox and follow the instructions to reset your password.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]
            );
        } catch (error: any) {
            let errorMessage = 'Failed to send reset email. Please try again.';

            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Please wait a moment before trying again.';
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <Pressable
                style={styles.backButton}
                onPress={() => router.back()}
            >
                <Ionicons name="arrow-back" size={24} color="#81171b" />
                <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <View style={styles.formContainer}>
                <View style={styles.header}>
                    <Ionicons name="lock-closed-outline" size={48} color="#81171b" />
                    <Text style={styles.title}>Reset Password</Text>
                    <Text style={styles.subtitle}>
                        Enter your email address and we'll send you a link to reset your password.
                    </Text>
                </View>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#666"
                        onChangeText={setEmail}
                        value={email}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoFocus
                        editable={!loading}
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleResetPassword}
                        disabled={loading}
                    >
                        {loading ? (
                            <Text style={styles.buttonText}>Sending...</Text>
                        ) : (
                            <Text style={styles.buttonText}>Send Reset Link</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Remember your password?</Text>
                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.linkText}>Back to Login</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 1,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    backButtonText: {
        color: '#81171b',
        fontSize: 16,
        fontWeight: '600',
    },
    formContainer: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 16,
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    form: {
        marginBottom: 40,
    },
    input: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
        fontSize: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    button: {
        backgroundColor: '#81171b',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#81171b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
        shadowOpacity: 0.1,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    linkButton: {
        marginTop: 8,
    },
    linkText: {
        color: '#81171b',
        fontSize: 16,
        fontWeight: '600',
    },
}); 