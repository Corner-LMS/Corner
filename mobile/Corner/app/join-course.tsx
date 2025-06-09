import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { db, auth } from '../config/ firebase-config';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { router } from 'expo-router';

export default function JoinCourseScreen() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleJoin = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) {
                Alert.alert('Error', 'You must be logged in to join a course.');
                return;
            }

            const q = query(collection(db, 'courses'), where('code', '==', code.trim().toUpperCase()));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                Alert.alert('Invalid code', 'No course found with this code.');
                setLoading(false);
                return;
            }

            const courseDoc = snapshot.docs[0];
            const courseId = courseDoc.id;
            const courseData = courseDoc.data();

            // Get current user data
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            // Update student's user document with course details
            await updateDoc(userRef, {
                courseIds: [...(userData?.courseIds || []), courseId],
                courseJoinDates: {
                    ...(userData?.courseJoinDates || {}),
                    [courseId]: new Date().toISOString()
                }
            });

            Alert.alert('Success', 'You have joined the course!');
            setTimeout(() => {
                router.replace('/(tabs)');
            }, 2000);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
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
                <Text style={styles.title}>Join a Course</Text>
                <Text style={styles.subtitle}>Enter the course code provided by your teacher</Text>

                <TextInput
                    placeholder="Enter course code"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    style={styles.input}
                    placeholderTextColor="#666"
                />

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleJoin}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'Joining...' : 'Join Course'}
                    </Text>
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
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
        fontSize: 16,
        textAlign: 'center',
        letterSpacing: 2,
    },
    button: {
        backgroundColor: '#81171b',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
