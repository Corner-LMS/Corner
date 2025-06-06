import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

interface UserData {
    name: string;
    email: string;
    role: string;
}

export default function Profile() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(auth.currentUser);
    const [userData, setUserData] = useState<UserData | null>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            setUser(user);
            if (user) {
                // Fetch user data from Firestore
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setUserData({
                            name: data.name || 'No name set',
                            email: data.email || user.email || 'No email',
                            role: data.role || 'No role set'
                        });
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await auth.signOut();
                            router.replace('/(auth)/login');
                        } catch (error) {
                            console.error('Error signing out:', error);
                            Alert.alert('Error', 'Failed to log out. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color="#81171b" />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {user && userData ? (
                    <>
                        {/* Header Section */}
                        <View style={styles.header}>
                            <View style={styles.profileIcon}>
                                <Ionicons
                                    name="person"
                                    size={40}
                                    color="#81171b"
                                />
                            </View>
                            <Text style={styles.welcomeText}>Welcome back!</Text>
                            <Text style={styles.userName}>{userData.name}</Text>
                        </View>

                        {/* Profile Information */}
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>Profile Information</Text>

                            <View style={styles.infoCard}>
                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconContainer}>
                                        <Ionicons name="person-outline" size={20} color="#81171b" />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Full Name</Text>
                                        <Text style={styles.infoValue}>{userData.name}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconContainer}>
                                        <Ionicons name="mail-outline" size={20} color="#81171b" />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Email Address</Text>
                                        <Text style={styles.infoValue}>{userData.email}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconContainer}>
                                        <Ionicons
                                            name={userData.role === 'teacher' ? 'school-outline' : 'library-outline'}
                                            size={20}
                                            color="#81171b"
                                        />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Role</Text>
                                        <View style={styles.roleContainer}>
                                            <Text style={styles.infoValue}>{userData.role}</Text>
                                            <View style={[
                                                styles.roleTag,
                                                userData.role === 'teacher' ? styles.teacherTag : styles.studentTag
                                            ]}>
                                                <Text style={styles.roleTagText}>{userData.role}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Actions Section */}
                        <View style={styles.actionsSection}>
                            <TouchableOpacity
                                style={styles.logoutButton}
                                onPress={handleLogout}
                            >
                                <Ionicons name="log-out-outline" size={20} color="#d32f2f" />
                                <Text style={styles.logoutButtonText}>Log Out</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    // Not logged in
                    <View style={styles.guestContent}>
                        <View style={styles.guestIcon}>
                            <Ionicons name="person-circle-outline" size={80} color="#ccc" />
                        </View>
                        <Text style={styles.guestTitle}>Welcome to Corner</Text>
                        <Text style={styles.guestSubtitle}>
                            Connect with teachers and students in a modern learning environment
                        </Text>

                        <View style={styles.guestActions}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => router.push('/(auth)/login')}
                            >
                                <Text style={styles.primaryButtonText}>Log In</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => router.push('/(auth)/signup')}
                            >
                                <Text style={styles.secondaryButtonText}>Create Account</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    profileIcon: {
        backgroundColor: '#81171b',
        borderRadius: 20,
        padding: 8,
        marginBottom: 12,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    userName: {
        fontSize: 18,
        color: '#666',
    },
    infoSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    infoCard: {
        backgroundColor: '#f8f8f8',
        borderRadius: 12,
        padding: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoIconContainer: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 8,
        marginRight: 16,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#e0e0e0',
        marginVertical: 16,
    },
    roleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    roleTag: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
    },
    teacherTag: {
        backgroundColor: '#81171b',
    },
    studentTag: {
        backgroundColor: '#D65108',
    },
    roleTagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        textTransform: 'capitalize',
    },
    actionsSection: {
        marginTop: 32,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#d32f2f',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        width: '100%',
    },
    logoutButtonText: {
        color: '#d32f2f',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    guestContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    guestIcon: {
        backgroundColor: '#ccc',
        borderRadius: 40,
        padding: 20,
        marginBottom: 24,
    },
    guestTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    guestSubtitle: {
        fontSize: 18,
        color: '#666',
        marginBottom: 48,
        textAlign: 'center',
        lineHeight: 24,
    },
    guestActions: {
        width: '100%',
        gap: 16,
    },
    primaryButton: {
        backgroundColor: '#81171b',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        width: '100%',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#81171b',
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
    loadingText: {
        fontSize: 18,
        color: '#666',
        marginTop: 12,
    },
});
