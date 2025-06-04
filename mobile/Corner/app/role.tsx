import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { saveUserRole } from './(auth)/useAuth';
import { router } from 'expo-router';

export default function RoleSelectionScreen() {
    const selectRole = async (role: 'student' | 'teacher') => {
        try {
            await saveUserRole(role);
            if (role === 'teacher') {
                router.replace('/(tabs)/create-course');
            } else {
                router.replace('/(tabs)');
            }
        } catch (err) {
            console.error(err);
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
            <View style={styles.content}>
                <Text style={styles.title}>I am a...</Text>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => selectRole('student')}
                    >
                        <Text style={styles.buttonText}>Student</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.secondaryButton]}
                        onPress={() => selectRole('teacher')}
                    >
                        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Teacher</Text>
                    </TouchableOpacity>
                </View>
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
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 48,
        textAlign: 'center',
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
});
