import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { login } from './useAuth';
import { router } from 'expo-router';
import { auth } from '../../config/ firebase-config';
import { doc } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';
import { db } from '../../config/ firebase-config';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        try {
            await login(email, password);
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
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
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
                <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <View style={styles.formContainer}>
                <Text style={styles.title}>Welcome Back</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#666"
                    onChangeText={setEmail}
                    value={email}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#666"
                    onChangeText={setPassword}
                    value={password}
                    secureTextEntry
                />
                {error && <Text style={styles.errorText}>{error}</Text>}
                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>Log In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    onPress={() => router.push('/(auth)/reset-password')}
                >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
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
        backgroundColor: '#fff',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 1,
        padding: 10,
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
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#81171b',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        color: '#ff3b30',
        marginBottom: 10,
        textAlign: 'center',
    },
    linkButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    linkText: {
        color: '#81171b',
        fontSize: 16,
    },
    forgotPasswordButton: {
        marginTop: 10,
        alignItems: 'center',
    },
    forgotPasswordText: {
        color: '#81171b',
        fontSize: 16,
    },
});
