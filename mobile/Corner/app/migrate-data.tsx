import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface Course {
    id: string;
    teacherId: string;
    schoolId?: string;
    name: string;
    instructorName?: string;
}

interface User {
    id: string;
    schoolId?: string;
    name: string;
    role: string;
}

export default function MigrateDataScreen() {
    const [loading, setLoading] = useState(false);
    const [migrationLog, setMigrationLog] = useState<string[]>([]);
    const [completed, setCompleted] = useState(false);

    const addLog = (message: string) => {
        setMigrationLog(prev => [...prev, message]);
        // console.log(message);
    };

    const migrateCourseSchools = async () => {
        setLoading(true);
        setMigrationLog([]);
        setCompleted(false);

        try {
            // Check if user is admin
            const user = auth().currentUser;
            if (!user) {
                Alert.alert('Error', 'You must be logged in as an admin to run migration.');
                setLoading(false);
                return;
            }

            const userDoc = await firestore().collection('users').doc(user.uid);
            const userSnap = await firestore().collection('users').get();
            const currentUser = userSnap.docs.find(doc => doc.id === user.uid);

            if (!currentUser || currentUser.data().role !== 'admin') {
                Alert.alert('Access Denied', 'Only admins can run data migration.');
                setLoading(false);
                return;
            }

            addLog('🔄 Starting course school migration...');

            // Get all courses
            const coursesSnapshot = await firestore().collection('courses').get();
            const courses: Course[] = coursesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Course));

            addLog(`📚 Found ${courses.length} courses to check`);

            // Filter courses that don't have schoolId
            const coursesWithoutSchool = courses.filter(course => !course.schoolId);
            addLog(`🔍 Found ${coursesWithoutSchool.length} courses without school association`);

            if (coursesWithoutSchool.length === 0) {
                addLog('✅ All courses already have school associations!');
                setCompleted(true);
                setLoading(false);
                return;
            }

            // Get all users (we need to check teachers)
            const usersSnapshot = await firestore().collection('users').get();
            const users: User[] = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as User));

            addLog(`👥 Found ${users.length} users`);

            // Create a map of teacherId -> schoolId
            const teacherSchoolMap: Record<string, string> = {};
            users.forEach(user => {
                if (user.role === 'teacher' && user.schoolId) {
                    teacherSchoolMap[user.id] = user.schoolId;
                }
            });

            addLog(`🏫 Found ${Object.keys(teacherSchoolMap).length} teachers with school associations`);

            // Use batch updates for better performance
            const batch = firestore().batch();
            let updateCount = 0;
            let skipCount = 0;

            for (const course of coursesWithoutSchool) {
                const teacherSchoolId = teacherSchoolMap[course.teacherId];

                if (teacherSchoolId) {
                    const courseRef = firestore().collection('courses').doc(course.id);
                    batch.update(courseRef, {
                        schoolId: teacherSchoolId
                    });
                    updateCount++;
                    addLog(`🔗 Will update course "${course.name}" with school ID`);
                } else {
                    skipCount++;
                    addLog(`⚠️ Skipping course "${course.name}" - teacher has no school`);
                }
            }

            if (updateCount > 0) {
                // Commit the batch
                await batch.commit();
                addLog(`✅ Successfully updated ${updateCount} courses with school associations`);
            }

            if (skipCount > 0) {
                addLog(`⚠️ Skipped ${skipCount} courses (teachers without school associations)`);
            }

            addLog('🎉 Migration completed!');
            addLog('');
            addLog('📊 Migration Summary:');
            addLog(`   Total courses: ${courses.length}`);
            addLog(`   Already had school: ${courses.length - coursesWithoutSchool.length}`);
            addLog(`   Updated with school: ${updateCount}`);
            addLog(`   Skipped (no teacher school): ${skipCount}`);

            setCompleted(true);
            Alert.alert('Success', 'Migration completed successfully! Analytics should now show the correct data.');

        } catch (error) {
            console.error('Migration failed:', error);
            addLog(`❌ Migration failed: ${error}`);
            Alert.alert('Error', 'Migration failed. Please check the logs and try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#81171b" />
                </TouchableOpacity>
                <Text style={styles.title}>Data Migration</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.infoCard}>
                    <Ionicons name="information-circle" size={24} color="#3b82f6" />
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Course School Association</Text>
                        <Text style={styles.infoText}>
                            This migration will update existing courses to be associated with their teacher's school.
                            This is needed for proper analytics and access control.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.migrateButton, loading && styles.buttonDisabled]}
                    onPress={migrateCourseSchools}
                    disabled={loading}
                >
                    <Ionicons name="sync" size={20} color="#fff" />
                    <Text style={styles.buttonText}>
                        {loading ? 'Running Migration...' : 'Run Course Migration'}
                    </Text>
                </TouchableOpacity>

                {migrationLog.length > 0 && (
                    <View style={styles.logContainer}>
                        <Text style={styles.logTitle}>Migration Log:</Text>
                        <ScrollView style={styles.logScroll} nestedScrollEnabled>
                            {migrationLog.map((log, index) => (
                                <Text key={index} style={styles.logText}>{log}</Text>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {completed && (
                    <View style={styles.successCard}>
                        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                        <Text style={styles.successText}>Migration completed successfully!</Text>
                        <Text style={styles.successSubtext}>
                            Analytics should now show school-filtered data correctly.
                        </Text>
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
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    backButton: {
        marginRight: 16,
        padding: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1f2937',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    infoContent: {
        flex: 1,
        marginLeft: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e40af',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 14,
        color: '#3730a3',
        lineHeight: 20,
    },
    migrateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#81171b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    buttonDisabled: {
        backgroundColor: '#9ca3af',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    logContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    logTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    logScroll: {
        maxHeight: 300,
    },
    logText: {
        fontSize: 12,
        fontFamily: 'monospace',
        color: '#374151',
        marginBottom: 4,
        lineHeight: 16,
    },
    successCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    successText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#065f46',
        marginLeft: 12,
    },
    successSubtext: {
        fontSize: 14,
        color: '#047857',
        marginTop: 4,
    },
}); 