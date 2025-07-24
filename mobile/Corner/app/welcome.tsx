import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
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
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Logo Section with Background */}
                <View style={styles.logoBackgroundSection}>
                    {renderLogoSection()}
                </View>

                <View style={styles.content}>
                    {/* Welcome Message */}
                    <View style={styles.welcomeSection}>
                        <Text style={styles.welcomeTitle}>Welcome to Corner</Text>
                        <Link href="/sitemap">
                            <Text>Sitemap</Text>
                        </Link>
                        <Text style={styles.welcomeDescription}>
                            Join us in transforming how students and teachers connect, learn, and grow together.
                        </Text>
                    </View>

                    {/* Features */}
                    <View style={styles.featuresSection}>
                        <View style={styles.feature}>
                            <View style={styles.featureIcon}>
                                <Ionicons name="people" size={20} color="#4f46e5" />
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
                                <Ionicons name="chatbubbles" size={20} color="#4f46e5" />
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
                                <Ionicons name="megaphone" size={20} color="#4f46e5" />
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
        backgroundColor: '#f1f5f9',
    },
    scrollContent: {
        flexGrow: 1,
    },
    // Logo Background Section - matches splash screen
    logoBackgroundSection: {
        width: '100%',
        height: 320, // Slightly taller for better centering
        backgroundColor: '#4f46e5', // Match logo color
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40, // More top padding for better centering
        paddingBottom: 20,
    },
    logoSection: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        backgroundColor: 'transparent', // Remove any background
    },
    logoIconContainer: {
        width: 96, // w-24 = 96px
        height: 96, // h-24 = 96px
        borderRadius: 48, // Perfect circle
        backgroundColor: '#4f46e5', // bg-indigo-600
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 24, // Space between logo and tagline
    },
    logoIconText: {
        fontSize: 50, // text-5xl equivalent
        fontWeight: '800', // font-extrabold
        color: '#ffffff', // text-white
        fontFamily: 'Georgia',
        letterSpacing: 4, // tracking-widest equivalent
    },
    tagline: {
        fontSize: 20,
        color: '#e0e7ff', // Lighter color for contrast
        fontWeight: '600',
        letterSpacing: 0.5,
        textAlign: 'center',
        lineHeight: 24,
    },
    content: {
        flex: 1,
        padding: 24,
    },
    welcomeSection: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    welcomeDescription: {
        fontSize: 17,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 26,
        paddingHorizontal: 20,
        fontWeight: '500',
    },
    featuresSection: {
        marginBottom: 32,
    },
    feature: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    featureIcon: {
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        borderRadius: 12,
        padding: 12,
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    featureDescription: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        fontWeight: '500',
    },
    ctaSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    ctaTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    ctaSubtitle: {
        fontSize: 16,
        color: '#64748b',
        marginBottom: 32,
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 24,
    },
    signupButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4f46e5',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 16,
        marginBottom: 20,
        width: '100%',
        justifyContent: 'center',
        elevation: 6,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
    },
    signupButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginRight: 10,
        letterSpacing: 0.3,
    },
    loginButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(79, 70, 229, 0.2)',
    },
    loginButtonText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    footer: {
        alignItems: 'center',
        paddingTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    footerText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        fontWeight: '500',
    },
}); 