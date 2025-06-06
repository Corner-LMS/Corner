import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert } from 'react-native';
import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs, getDoc, doc, DocumentReference, updateDoc, deleteDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [studentCourses, setStudentCourses] = useState<any[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});

  const loadUserAndCourses = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      router.replace('/welcome');
      return;
    }

    try {
      // 🔎 Get user role from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        console.error('User document does not exist');
        setLoading(false);
        return;
      }

      const userData = userDocSnap.data();
      setRole(userData.role);

      // If student, get all their courses
      if (userData.role === 'student' && userData.courseIds) {
        try {
          const coursesList = [];
          const teacherNamesMap: Record<string, string> = {};

          for (const courseId of userData.courseIds) {
            const courseRef = doc(db, 'courses', courseId);
            const courseSnap = await getDoc(courseRef);
            if (courseSnap.exists()) {
              const courseData = courseSnap.data();
              coursesList.push({
                ...courseData,
                id: courseId,
                joinedAt: userData.courseJoinDates?.[courseId] || new Date().toISOString()
              });

              // Get teacher's name
              const teacherRef = doc(db, 'users', courseData.teacherId);
              const teacherSnap = await getDoc(teacherRef);
              if (teacherSnap.exists()) {
                teacherNamesMap[courseId] = teacherSnap.data().name || 'Unknown Teacher';
              }
            }
          }
          setStudentCourses(coursesList);
          setTeacherNames(teacherNamesMap);
        } catch (error) {
          console.error('Error fetching student courses:', error);
          setStudentCourses([]);
          setTeacherNames({});
        }
      }

      // 📚 Get all courses created by teacher (excluding archived ones)
      if (userData.role === 'teacher') {
        try {
          const q = query(
            collection(db, 'courses'),
            where('teacherId', '==', user.uid)
          );
          const snapshot = await getDocs(q);
          // Filter out archived courses in JavaScript to handle courses without archived field
          const coursesList = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((course: any) => course.archived !== true);
          setCourses(coursesList);
        } catch (error) {
          console.error('Error fetching teacher courses:', error);
          setCourses([]); // Set empty array on error
        }
      }
    } catch (error) {
      console.error('Error in loadUserAndCourses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');

      if (!user) {
        setLoading(false);
        router.replace('/welcome');
        return;
      }

      await loadUserAndCourses();
    });

    return () => unsubscribe();
  }, []);

  // Refresh data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (auth.currentUser) {
        loadUserAndCourses();
      }
    }, [])
  );

  const handleUnjoinCourse = async (courseId: string, courseName: string) => {
    Alert.alert(
      'Leave Course',
      `Are you sure you want to leave "${courseName}"? This course will be moved to your archives.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;

              const userRef = doc(db, 'users', user.uid);
              const userSnap = await getDoc(userRef);

              if (userSnap.exists()) {
                const userData = userSnap.data();
                const archivedCourseIds = userData.archivedCourseIds || [];
                const courseArchiveDates = userData.courseArchiveDates || {};

                // Add to archived courses
                archivedCourseIds.push(courseId);
                courseArchiveDates[courseId] = new Date().toISOString();

                // Update user document
                await updateDoc(userRef, {
                  courseIds: arrayRemove(courseId),
                  archivedCourseIds: archivedCourseIds,
                  courseArchiveDates: courseArchiveDates
                });

                // Update local state
                setStudentCourses(prev => prev.filter(course => course.id !== courseId));

                Alert.alert('Success', `You have left "${courseName}". You can find it in your archives.`);
              }
            } catch (error) {
              console.error('Error leaving course:', error);
              Alert.alert('Error', 'Failed to leave course. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    Alert.alert(
      'Delete Course',
      `Are you sure you want to permanently delete "${courseName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the course document
              await deleteDoc(doc(db, 'courses', courseId));

              // Update local state
              setCourses(prev => prev.filter(course => course.id !== courseId));

              Alert.alert('Success', `"${courseName}" has been permanently deleted.`);
            } catch (error) {
              console.error('Error deleting course:', error);
              Alert.alert('Error', 'Failed to delete course. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleArchiveCourse = async (courseId: string, courseName: string) => {
    Alert.alert(
      'Archive Course',
      `Are you sure you want to archive "${courseName}"? You can find it in your archives later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              // Update course to be archived
              await updateDoc(doc(db, 'courses', courseId), {
                archived: true,
                archivedAt: new Date().toISOString()
              });

              // Update local state
              setCourses(prev => prev.filter(course => course.id !== courseId));

              Alert.alert('Success', `"${courseName}" has been archived.`);
            } catch (error) {
              console.error('Error archiving course:', error);
              Alert.alert('Error', 'Failed to archive course. Please try again.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#81171b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome to Corner 🎓</Text>
          <Text style={styles.role}>You are logged in as a {role}</Text>

          {role === 'student' && studentCourses.length > 0 ? (
            studentCourses.map((course) => (
              <View key={course.id} style={styles.courseContainer}>
                <TouchableOpacity
                  style={styles.courseBox}
                  onPress={() => router.push({
                    pathname: '/course-detail',
                    params: {
                      courseId: course.id,
                      courseName: course.name,
                      courseCode: course.code,
                      instructorName: course.instructorName,
                      role: role
                    }
                  })}
                >
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseName}>{course.name}</Text>
                    <TouchableOpacity
                      style={styles.subtleActionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleUnjoinCourse(course.id, course.name);
                      }}
                    >
                      <Ionicons name="exit-outline" size={18} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.courseDetail}>
                    <Text style={styles.courseLabel}>Course Code:</Text>
                    <Text style={styles.courseValue}>{course.code}</Text>
                  </View>
                  <View style={styles.courseDetail}>
                    <Text style={styles.courseLabel}>Instructor:</Text>
                    <Text style={styles.courseValue}>{course.instructorName}</Text>
                  </View>
                  <View style={styles.courseDetail}>
                    <Text style={styles.courseLabel}>Course Created:</Text>
                    <Text style={styles.courseValue}>
                      {new Date(course.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.courseDetail}>
                    <Text style={styles.courseLabel}>You Joined:</Text>
                    <Text style={styles.courseValue}>
                      {new Date(course.joinedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          ) : role === 'teacher' && courses.length > 0 ? (
            courses.map((course) => (
              <View key={course.id} style={styles.courseContainer}>
                <TouchableOpacity
                  style={styles.courseBox}
                  onPress={() => router.push({
                    pathname: '/course-detail',
                    params: {
                      courseId: course.id,
                      courseName: course.name,
                      courseCode: course.code,
                      instructorName: course.instructorName,
                      role: role
                    }
                  })}
                >
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseName}>{course.name}</Text>
                    <View style={styles.subtleActionsGroup}>
                      <TouchableOpacity
                        style={styles.subtleActionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleArchiveCourse(course.id, course.name);
                        }}
                      >
                        <Ionicons name="archive-outline" size={18} color="#666" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.subtleActionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteCourse(course.id, course.name);
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#d32f2f" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.courseDetail}>
                    <Text style={styles.courseLabel}>Course Code:</Text>
                    <Text style={styles.courseValue}>{course.code}</Text>
                  </View>
                  <View style={styles.courseDetail}>
                    <Text style={styles.courseLabel}>Description:</Text>
                    <Text style={styles.courseValue}>{course.description || 'No description'}</Text>
                  </View>
                  <View style={styles.courseDetail}>
                    <Text style={styles.courseLabel}>Instructor:</Text>
                    <Text style={styles.courseValue}>{course.instructorName}</Text>
                  </View>
                  <View style={styles.courseDetail}>
                    <Text style={styles.courseLabel}>Created:</Text>
                    <Text style={styles.courseValue}>
                      {new Date(course.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.noCourseBox}>
              <Text style={styles.noCourseText}>No courses found.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {role === 'teacher' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/create-course')}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {role === 'student' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/join-course')}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  role: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  courseContainer: {
    marginBottom: 30,
  },
  courseBox: {
    backgroundColor: '#e0e0e0',
    padding: 20,
    borderRadius: 10,
    marginBottom: 10,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courseName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#81171b',
    marginBottom: 15,
  },
  courseDetail: {
    marginBottom: 10,
  },
  courseLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  courseValue: {
    fontSize: 16,
    color: '#333',
  },
  noCourseBox: {
    backgroundColor: '#f8f8f8',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    alignItems: 'center',
  },
  noCourseText: {
    fontSize: 16,
    color: '#666',
  },
  button: {
    backgroundColor: '#81171b',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#81171b',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  subtleActionButton: {
    padding: 4,
  },
  subtleActionsGroup: {
    flexDirection: 'row',
    gap: 4,
  },
});
