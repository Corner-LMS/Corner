import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import { Ionicons } from '@expo/vector-icons';
import { ProfileInitials } from '@/components/ui/ProfileInitials';
import { getSchoolById } from '@/constants/Schools';
import ConnectivityIndicator from '../../components/ConnectivityIndicator';
import { LinearGradient } from 'expo-linear-gradient';

interface UserData {
    name: string;
    email: string;
    role: string;
    schoolId?: string;
}

export default function Profile() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(auth().currentUser);
    const [userData, setUserData] = useState<UserData | null>(null);

    useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged(async (user) => {
            setUser(user);
            if (user) {
                // Fetch user data from Firestore
                try {
                    const userDoc = await firestore().collection('users').doc(user.uid).get();
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setUserData({
                            name: data?.name || 'No name set',
                            email: data?.email || user.email || 'No email',
                            role: data?.role || 'No role set',
                            schoolId: data?.schoolId
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
                            await auth().signOut();
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
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
                <LinearGradient
                    colors={['#4f46e5', '#3730a3']}
                    style={styles.header}
                >
                    <View style={{ width: 24 }} />
                    <Text style={styles.title}>Your Profile</Text>
                    <ConnectivityIndicator size="small" style={styles.connectivityIndicator} />
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4f46e5" />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <View style={{ width: 24 }} />
                <Text style={styles.title}>Profile</Text>
                <ConnectivityIndicator size="small" style={styles.connectivityIndicator} />
            </LinearGradient>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {user && userData ? (
                    <>
                        {/* Profile Card */}
                        <View style={styles.profileCard}>
                            <View style={styles.profileHeader}>
                                <View style={styles.avatarContainer}>
                                    <ProfileInitials size={80} color="#4f46e5" variant="header" />
                                </View>
                                <Text style={styles.welcomeText}>Welcome back!</Text>
                                <Text style={styles.userName}>{userData.name}</Text>
                                <View style={[
                                    styles.roleTag,
                                    userData.role === 'teacher' ? styles.teacherTag :
                                        userData.role === 'admin' ? styles.adminTag : styles.studentTag
                                ]}>
                                    <Ionicons
                                        name={userData.role === 'teacher' ? 'school' : userData.role === 'admin' ? 'shield-checkmark' : 'library'}
                                        size={14}
                                        color="#fff"
                                    />
                                    <Text style={styles.roleTagText}>{userData.role}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Profile Information */}
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>Profile Information</Text>

                            <View style={styles.infoCard}>
                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconContainer}>
                                        <Ionicons name="person-outline" size={20} color="#4f46e5" />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Full Name</Text>
                                        <Text style={styles.infoValue}>{userData.name}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconContainer}>
                                        <Ionicons name="mail-outline" size={20} color="#4f46e5" />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Email Address</Text>
                                        <Text style={styles.infoValue}>{userData.email}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconContainer}>
                                        <Ionicons name="school-outline" size={20} color="#4f46e5" />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>School</Text>
                                        <Text style={styles.infoValue}>
                                            {userData.schoolId ? getSchoolById(userData.schoolId)?.name || 'Unknown School' : 'No school assigned'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.infoRow}>
                                    <View style={styles.infoIconContainer}>
                                        <Ionicons
                                            name={userData.role === 'teacher' ? 'school-outline' : userData.role === 'admin' ? 'shield-checkmark-outline' : 'library-outline'}
                                            size={20}
                                            color="#4f46e5"
                                        />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>Role</Text>
                                        <Text style={styles.infoValue}>{userData.role}</Text>
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
                                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                                <Text style={styles.logoutButtonText}>Log Out</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    // Not logged in
                    <View style={styles.guestContent}>
                        <View style={styles.guestCard}>
                            <View style={styles.guestIcon}>
                                <Ionicons name="person-circle-outline" size={80} color="#64748b" />
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
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        paddingTop: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: -0.3,
    },
    connectivityIndicator: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 120,
    },
    loadingText: {
        fontSize: 16,
        color: '#64748b',
        marginTop: 12,
        fontWeight: '500',
    },
    profileCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
        overflow: 'hidden',
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
    },
    avatarContainer: {
        marginBottom: 16,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 4,
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 8,
        letterSpacing: 0.2,
    },
    userName: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 16,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    roleTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    teacherTag: {
        backgroundColor: '#4f46e5',
    },
    studentTag: {
        backgroundColor: '#0891b2',
    },
    adminTag: {
        backgroundColor: '#059669',
    },
    roleTagText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        textTransform: 'capitalize',
        letterSpacing: 0.5,
    },
    infoSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
        letterSpacing: -0.3,
        paddingHorizontal: 4,
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    infoIconContainer: {
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        borderRadius: 12,
        padding: 12,
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.1)',
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    infoValue: {
        fontSize: 16,
        color: '#1e293b',
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 16,
    },
    actionsSection: {
        marginTop: 8,
        marginBottom: 40,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#ef4444',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        width: '100%',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    logoutButtonText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 8,
        letterSpacing: 0.3,
    },
    guestContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    guestCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    guestIcon: {
        backgroundColor: 'rgba(100, 116, 139, 0.1)',
        borderRadius: 50,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.2)',
    },
    guestTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 12,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    guestSubtitle: {
        fontSize: 16,
        color: '#64748b',
        marginBottom: 32,
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500',
        letterSpacing: 0.2,
    },
    guestActions: {
        width: '100%',
        gap: 16,
    },
    primaryButton: {
        backgroundColor: '#4f46e5',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    secondaryButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#4f46e5',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    secondaryButtonText: {
        color: '#4f46e5',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
