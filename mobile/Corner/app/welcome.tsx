import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Ionicons name="school" size={48} color="#81171b" />
                        </View>
                        <Text style={styles.appName}>Corner</Text>
                        <Text style={styles.tagline}>Connect • Learn • Grow</Text>
                    </View>

                    {/* Welcome Message */}
                    <View style={styles.welcomeSection}>
                        <Text style={styles.welcomeTitle}>Welcome to Corner</Text>
                        <Text style={styles.welcomeDescription}>
                            Join us in transforming how students and teachers connect, learn, and grow together.
                        </Text>
                    </View>

                    {/* Features */}
                    <View style={styles.featuresSection}>
                        <View style={styles.feature}>
                            <View style={styles.featureIcon}>
                                <Ionicons name="people" size={20} color="#81171b" />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>Connect</Text>
                                <Text style={styles.featureDescription}>
                                    Join courses and connect with teachers and students
                                </Text>
                            </View>
                        </View>

                        <View style={styles.feature}>
                            <View style={styles.featureIcon}>
                                <Ionicons name="chatbubbles" size={20} color="#81171b" />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>Discuss</Text>
                                <Text style={styles.featureDescription}>
                                    Engage in discussions and get answers
                                </Text>
                            </View>
                        </View>

                        <View style={styles.feature}>
                            <View style={styles.featureIcon}>
                                <Ionicons name="megaphone" size={20} color="#81171b" />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>Stay Updated</Text>
                                <Text style={styles.featureDescription}>
                                    Receive important announcements
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Call to Action */}
                    <View style={styles.ctaSection}>
                        <Text style={styles.ctaTitle}>Ready to get started?</Text>
                        <Text style={styles.ctaSubtitle}>Join thousands of students and teachers already using Corner</Text>

                        <TouchableOpacity
                            style={styles.signupButton}
                            onPress={() => router.push('/(auth)/signup')}
                        >
                            <Text style={styles.signupButtonText}>Create Account</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={() => router.push('/(auth)/login')}
                        >
                            <Text style={styles.loginButtonText}>I already have an account</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Made with ❤️ for the educational community
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 16,
    },
    logoContainer: {
        backgroundColor: '#f8f8f8',
        borderRadius: 20,
        padding: 12,
        marginBottom: 12,
    },
    appName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#81171b',
        marginBottom: 6,
    },
    tagline: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    welcomeSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    welcomeTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        textAlign: 'center',
    },
    welcomeDescription: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    featuresSection: {
        marginBottom: 24,
    },
    feature: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    featureIcon: {
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        padding: 10,
        marginRight: 12,
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    featureDescription: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
    },
    ctaSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    ctaTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 6,
        textAlign: 'center',
    },
    ctaSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 24,
        textAlign: 'center',
    },
    signupButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#81171b',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        marginBottom: 16,
        width: '100%',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    signupButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginRight: 8,
    },
    loginButton: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 8,
    },
    loginButtonText: {
        color: '#81171b',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    footer: {
        alignItems: 'center',
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    footerText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
}); 