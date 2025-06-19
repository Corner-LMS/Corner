import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const faqs = [
    {
        question: "How do I join a course?",
        answer: "To join a course, you'll need a course code from your teacher. Go to the Courses tab and tap the '+' button to enter the code. Once entered, you'll be enrolled in the course."
    },
    {
        question: "How do I submit assignments?",
        answer: "Navigate to the course where the assignment is posted. Find the assignment in the course content, tap on it, and use the 'Submit' button to upload your work. Make sure to check the submission deadline!"
    },
    {
        question: "How do I participate in discussions?",
        answer: "In any course, go to the Discussions tab. You can view existing discussions and tap 'New Post' to start a new one. You can also reply to existing posts by tapping on them."
    },
    {
        question: "How do I contact my teacher?",
        answer: "You can contact your teacher through the course's discussion board or by sending them a direct message. Go to the course, tap on the teacher's name, and select 'Send Message'."
    },
    {
        question: "How do I manage my notifications?",
        answer: "Tap the settings icon in the top right corner of any screen, then select 'Notification Settings'. Here you can customize which notifications you want to receive."
    },
    {
        question: "How do I update my profile?",
        answer: "Go to your profile by tapping your avatar in the top left corner. Tap 'Edit Profile' to update your information, profile picture, or preferences."
    },
    {
        question: "What if I forget my password?",
        answer: "On the login screen, tap 'Forgot Password'. Enter your email address, and we'll send you instructions to reset your password."
    },
    {
        question: "How do I leave a course?",
        answer: "Go to the course you want to leave, tap the three dots menu in the top right, and select 'Leave Course'. Note that this action cannot be undone."
    }
];

export default function SupportPage() {
    const handleContactSupport = () => {
        Linking.openURL('mailto:support@corner.com');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#4f46e5" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Support & Help</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                    {faqs.map((faq, index) => (
                        <View key={index} style={styles.faqItem}>
                            <Text style={styles.question}>{faq.question}</Text>
                            <Text style={styles.answer}>{faq.answer}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Links</Text>
                    <TouchableOpacity style={styles.linkItem}>
                        <Ionicons name="document-text-outline" size={20} color="#4f46e5" />
                        <Text style={styles.linkText}>Privacy Policy</Text>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.linkItem}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#4f46e5" />
                        <Text style={styles.linkText}>Terms of Service</Text>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.contactButton}
                    onPress={handleContactSupport}
                >
                    <Ionicons name="mail-outline" size={20} color="#fff" />
                    <Text style={styles.contactButtonText}>Contact Support</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(241, 245, 249, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 24,
        letterSpacing: -0.3,
    },
    faqItem: {
        marginBottom: 24,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    question: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 8,
    },
    answer: {
        fontSize: 15,
        color: '#64748b',
        lineHeight: 22,
    },
    linkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    linkText: {
        flex: 1,
        fontSize: 16,
        color: '#1e293b',
        marginLeft: 12,
        fontWeight: '500',
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4f46e5',
        padding: 16,
        borderRadius: 12,
        marginBottom: 40,
        gap: 8,
    },
    contactButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
}); 