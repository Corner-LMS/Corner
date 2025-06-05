import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../firebase/config';

export default function Profile() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(auth.currentUser);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            router.replace('/(auth)/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#81171b" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome to Corner 📚</Text>
                <Text style={styles.subtitle}>A better way for students and teachers to connect.</Text>

                <View style={styles.buttonContainer}>
                    {user ? (
                        <TouchableOpacity
                            style={[styles.button, styles.secondaryButton]}
                            onPress={handleLogout}
                        >
                            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Log Out</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={() => router.push('/(auth)/login')}
                            >
                                <Text style={styles.buttonText}>Log In</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, styles.secondaryButton]}
                                onPress={() => router.push('/(auth)/signup')}
                            >
                                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Sign Up</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#666',
        marginBottom: 48,
        textAlign: 'center',
        lineHeight: 24,
    },
    buttonContainer: {
        width: '100%',
        gap: 16,
    },
    button: {
        backgroundColor: '#81171b',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        width: '100%',
    },
    secondaryButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#81171b',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButtonText: {
        color: '#81171b',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
});
