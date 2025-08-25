import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import firestore, { serverTimestamp } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface Question {
    id: string;
    text: string;
    options: string[];
    type: 'single' | 'multiple';
}

const surveyQuestions: Question[] = [
    {
        id: 'usability',
        text: 'How easy is Corner to use?',
        options: ['Very Easy', 'Easy', 'Neutral', 'Difficult', 'Very Difficult'],
        type: 'single'
    },
    {
        id: 'features',
        text: 'Which features do you use most often? (Select all that apply)',
        options: ['Discussions', 'Announcements', 'AI Assistant', 'Course Resources', 'Notifications'],
        type: 'multiple'
    },
    {
        id: 'satisfaction',
        text: 'How satisfied are you with Corner overall?',
        options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'],
        type: 'single'
    },
    {
        id:'adoption',
        text:'If your school adopts Corner, would you personally use it?',
        options: ['Definitely', 'Probably', 'Not Sure', 'Probably Not', 'Definitely Not'],
        type: 'single'
    },
    {
        id: 'recommend',
        text: 'How likely are you to recommend Corner to others?',
        options: ['Very Likely', 'Likely', 'Neutral', 'Unlikely', 'Very Unlikely'],
        type: 'single'
    },
    {
        id: 'improvement',
        text: 'What would you like to see improved in Corner?',
        options: ['User Interface', 'Performance', 'Features', 'Notifications', 'AI Assistant'],
        type: 'multiple'
    }
];

export default function SurveyScreen() {
    const [answers, setAnswers] = useState<{ [key: string]: string | string[] }>({});
    const [suggestion, setSuggestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAnswerSelect = (questionId: string, answer: string, type: 'single' | 'multiple') => {
        if (type === 'single') {
            setAnswers(prev => ({
                ...prev,
                [questionId]: answer
            }));
        } else {
            setAnswers(prev => {
                const currentAnswers = prev[questionId] as string[] || [];
                const newAnswers = currentAnswers.includes(answer)
                    ? currentAnswers.filter(a => a !== answer)
                    : [...currentAnswers, answer];
                return {
                    ...prev,
                    [questionId]: newAnswers
                };
            });
        }
    };

    const isAnswerSelected = (questionId: string, answer: string): boolean => {
        const currentAnswer = answers[questionId];
        if (Array.isArray(currentAnswer)) {
            return currentAnswer.includes(answer);
        }
        return currentAnswer === answer;
    };

    const handleSubmit = async () => {
        // Check if all single-choice questions are answered
        const unansweredQuestions = surveyQuestions.filter(q =>
            q.type === 'single' && !answers[q.id]
        );

        if (unansweredQuestions.length > 0) {
            Alert.alert(
                'Incomplete Survey',
                'Please answer all required questions before submitting.',
                [{ text: 'OK' }]
            );
            return;
        }

        const user = auth().currentUser;
        if (!user) {
            Alert.alert('Authentication Required', 'Please log in to submit the survey.');
            return;
        }

        setIsSubmitting(true);

        try {
            const surveyData = {
                userId: user.uid,
                userEmail: user.email,
                answers: answers,
                suggestion: suggestion.trim(),
                createdAt: serverTimestamp(),
                userAgent: 'Corner Mobile App',
                version: '1.0.0'
            };

            await firestore().collection('surveys').add(surveyData);

            Alert.alert(
                'Thank You!',
                'Your survey response has been submitted successfully. Your feedback helps us improve Corner!',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setAnswers({});
                            setSuggestion('');
                            router.back();
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Error submitting survey:', error);
            Alert.alert('Error', 'Failed to submit survey. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderQuestion = (question: Question, index: number) => (
        <View key={question.id} style={styles.questionContainer}>
            <Text style={styles.questionNumber}>Question {index + 1}</Text>
            <Text style={styles.questionText}>{question.text}</Text>

            <View style={styles.optionsContainer}>
                {question.options.map((option, optionIndex) => (
                    <TouchableOpacity
                        key={optionIndex}
                        style={[
                            styles.optionButton,
                            isAnswerSelected(question.id, option) && styles.optionButtonSelected
                        ]}
                        onPress={() => handleAnswerSelect(question.id, option, question.type)}
                    >
                        <View style={styles.optionContent}>
                            {question.type === 'single' ? (
                                <Ionicons
                                    name={isAnswerSelected(question.id, option) ? "radio-button-on" : "radio-button-off"}
                                    size={20}
                                    color={isAnswerSelected(question.id, option) ? "#4f46e5" : "#9ca3af"}
                                />
                            ) : (
                                <Ionicons
                                    name={isAnswerSelected(question.id, option) ? "checkbox" : "square-outline"}
                                    size={20}
                                    color={isAnswerSelected(question.id, option) ? "#4f46e5" : "#9ca3af"}
                                />
                            )}
                            <Text style={[
                                styles.optionText,
                                isAnswerSelected(question.id, option) && styles.optionTextSelected
                            ]}>
                                {option}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

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
                <Text style={styles.headerTitle}>Survey</Text>
                <View style={styles.headerSpacer} />
            </LinearGradient>

            <ScrollView style={styles.content}>
                <View style={styles.card}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="clipboard" size={48} color="#4f46e5" />
                    </View>

                    <Text style={styles.title}>Help Us Improve Corner</Text>
                    <Text style={styles.subtitle}>
                        Your responses help us understand how to make Corner better for everyone
                    </Text>

                    {surveyQuestions.map((question, index) =>
                        renderQuestion(question, index)
                    )}

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Additional Suggestions (Optional)</Text>
                        <TextInput
                            style={styles.textArea}
                            value={suggestion}
                            onChangeText={setSuggestion}
                            placeholder="Any other suggestions for improving Corner..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            numberOfLines={4}
                            maxLength={500}
                        />
                        <Text style={styles.charCount}>{suggestion.length}/500</Text>
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
                                    <Text style={styles.submitButtonText}>Submit Survey</Text>
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
    questionContainer: {
        marginBottom: 32,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    questionNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4f46e5',
        marginBottom: 8,
    },
    questionText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 16,
        lineHeight: 24,
    },
    optionsContainer: {
        gap: 12,
    },
    optionButton: {
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#f8fafc',
    },
    optionButtonSelected: {
        borderColor: '#4f46e5',
        backgroundColor: '#eff6ff',
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    optionText: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '500',
        flex: 1,
    },
    optionTextSelected: {
        color: '#1e293b',
        fontWeight: '600',
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
    charCount: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'right',
        marginTop: 4,
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