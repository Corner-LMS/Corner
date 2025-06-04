import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { auth } from '../firebase/config';
import { createCourse } from '../(auth)/useCourses';
import { router } from 'expo-router';

export default function CreateCourseScreen() {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async () => {
        try {
            const teacherId = auth.currentUser?.uid;
            if (!teacherId) {
                setError('No teacher ID found');
                return;
            }
            const { code } = await createCourse(name, desc, teacherId);
            setCode(code);
            router.replace('/(tabs)');
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
                <Text style={styles.title}>Create a Course</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Course Name"
                    placeholderTextColor="#666"
                    value={name}
                    onChangeText={setName}
                />
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description (optional)"
                    placeholderTextColor="#666"
                    value={desc}
                    onChangeText={setDesc}
                    multiline
                    numberOfLines={4}
                />
                {error && <Text style={styles.errorText}>{error}</Text>}
                <TouchableOpacity
                    style={styles.button}
                    onPress={handleCreate}
                >
                    <Text style={styles.buttonText}>Create Course</Text>
                </TouchableOpacity>

                {code ? (
                    <View style={styles.codeContainer}>
                        <Text style={styles.codeText}>
                            ✅ Course created! Share this code with your students:
                        </Text>
                        <Text style={styles.codeValue}>{code}</Text>
                    </View>
                ) : null}
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
    textArea: {
        height: 100,
        textAlignVertical: 'top',
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
    codeContainer: {
        marginTop: 30,
        padding: 20,
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        alignItems: 'center',
    },
    codeText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 10,
        textAlign: 'center',
    },
    codeValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#81171b',
        letterSpacing: 2,
    },
});
