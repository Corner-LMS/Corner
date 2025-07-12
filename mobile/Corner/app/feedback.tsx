import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import firestore, { serverTimestamp } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

export default function FeedbackScreen() {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRatingPress = (selectedRating: number) => {
        setRating(selectedRating);
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Rating Required', 'Please select a rating before submitting.');
            return;
        }

        const user = auth().currentUser;
        if (!user) {
            Alert.alert('Authentication Required', 'Please log in to submit feedback.');
            return;
        }

        setIsSubmitting(true);

        try {
            const feedbackData = {
                userId: user.uid,
                userEmail: user.email || email,
                rating: rating,
                comment: comment.trim(),
                email: email.trim(),
                createdAt: serverTimestamp(),
                userAgent: 'Corner Mobile App',
                version: '1.0.0'
            };

            await firestore().collection('feedback').add(feedbackData);

            Alert.alert(
                'Thank You!',
                'Your feedback has been submitted successfully. We appreciate your input!',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setRating(0);
                            setComment('');
                            setEmail('');
                            router.back();
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Error submitting feedback:', error);
            Alert.alert('Error', 'Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStars = () => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <TouchableOpacity
                    key={i}
                    style={styles.starButton}
                    onPress={() => handleRatingPress(i)}
                >
                    <Ionicons
                        name={i <= rating ? "star" : "star-outline"}
                        size={32}
                        color={i <= rating ? "#fbbf24" : "#d1d5db"}
                    />
                </TouchableOpacity>
            );
        }
        return stars;
    };

    const getRatingText = () => {
        switch (rating) {
            case 1: return 'Poor';
            case 2: return 'Fair';
            case 3: return 'Good';
            case 4: return 'Very Good';
            case 5: return 'Excellent';
            default: return 'Select Rating';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4f46e5" />
            <LinearGradient
                colors={['#4f46e5', '#3730a3']}
                style={styles.header}
            >
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Feedback</Text>
                <View style={styles.headerSpacer} />
            </LinearGradient>

            <ScrollView style={styles.content}>
                <View style={styles.card}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="chatbubble-ellipses" size={48} color="#4f46e5" />
                    </View>

                    <Text style={styles.title}>How would you rate Corner?</Text>
                    <Text style={styles.subtitle}>
                        Your feedback helps us improve the app for everyone
                    </Text>

                    <View style={styles.ratingContainer}>
                        <View style={styles.starsContainer}>
                            {renderStars()}
                        </View>
                        <Text style={styles.ratingText}>{getRatingText()}</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Additional Comments (Optional)</Text>
                        <TextInput
                            style={styles.textArea}
                            value={comment}
                            onChangeText={setComment}
                            placeholder="Tell us what you think about Corner..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            numberOfLines={4}
                            maxLength={500}
                        />
                        <Text style={styles.charCount}>{comment.length}/500</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="your.email@example.com"
                            placeholderTextColor="#9ca3af"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <Text style={styles.helperText}>
                            We'll use this to follow up on your feedback if needed
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        <LinearGradient
                            colors={['#4f46e5', '#3730a3']}
                            style={styles.submitButtonGradient}
                        >
                            {isSubmitting ? (
                                <Text style={styles.submitButtonText}>Submitting...</Text>
                            ) : (
                                <>
                                    <Ionicons name="send" size={20} color="#fff" />
                                    <Text style={styles.submitButtonText}>Submit Feedback</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
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
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 24,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    ratingContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    starsContainer: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    starButton: {
        padding: 8,
        marginHorizontal: 4,
    },
    ratingText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4f46e5',
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 8,
    },
    textArea: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    textInput: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
    },
    charCount: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'right',
        marginTop: 4,
    },
    helperText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
        fontStyle: 'italic',
    },
    submitButton: {
        borderRadius: 12,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
}); 