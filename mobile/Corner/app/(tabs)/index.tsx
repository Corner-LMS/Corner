import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert } from 'react-native';
import { auth, db } from '../../config/ firebase-config';
import { collection, query, where, getDocs, getDoc, doc, DocumentReference, updateDoc, deleteDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NotificationBadge from '../../components/NotificationBadge';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [studentCourses, setStudentCourses] = useState<any[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);

  const loadUserAndCourses = async (user: User) => {
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

      // 🔑 Admin can see all courses in the system
      if (userData.role === 'admin') {
        try {
          const snapshot = await getDocs(collection(db, 'courses'));
          // Get all courses (archived and active) for admin overview
          const coursesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCourses(coursesList);

          // Get teacher names for all courses
          const teacherNamesMap: Record<string, string> = {};
          for (const course of coursesList) {
            const courseData = course as any; // Type assertion for Firebase data
            if (courseData.teacherId && !teacherNamesMap[courseData.teacherId]) {
              try {
                const teacherRef = doc(db, 'users', courseData.teacherId);
                const teacherSnap = await getDoc(teacherRef);
                if (teacherSnap.exists()) {
                  teacherNamesMap[courseData.teacherId] = teacherSnap.data().name || 'Unknown Teacher';
                }
              } catch (error) {
                console.error('Error fetching teacher name:', error);
                teacherNamesMap[courseData.teacherId] = 'Unknown Teacher';
              }
            }
          }
          setTeacherNames(teacherNamesMap);
        } catch (error) {
          console.error('Error fetching admin courses:', error);
          setCourses([]);
        }
      }
    } catch (error) {
      console.error('Error in loadUserAndCourses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        loadUserAndCourses(user);
      } else {
        setCourses([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Refresh data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (auth.currentUser) {
        loadUserAndCourses(auth.currentUser);
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
          <View style={styles.header}>
            <TouchableOpacity style={styles.menuButton} onPress={() => {/* TODO: Add menu functionality */ }}>
              <Ionicons name="menu" size={24} color="#1e293b" />
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>LOGO</Text>
              </View>
            </View>

            <View style={styles.rightActions}>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{role.charAt(0).toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/notification-settings')}>
                <Ionicons name="settings-outline" size={20} color="#64748b" />
              </TouchableOpacity>
              <NotificationBadge size="medium" />
            </View>
          </View>

          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome back! 👋</Text>
            <Text style={styles.welcomeSubtext}>
              {role === 'admin' ? 'Platform Overview' : 'Here are your courses'}
            </Text>
          </View>

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
          ) : role === 'admin' && courses.length > 0 ? (
            courses.map((course) => {
              const courseData = course as any;
              const teacherName = courseData.teacherId ? teacherNames[courseData.teacherId] : 'Unknown Teacher';
              const isArchived = courseData.archived === true;

              return (
                <View key={course.id} style={styles.courseContainer}>
                  <TouchableOpacity
                    style={[styles.courseBox, isArchived && styles.archivedCourseBox]}
                    onPress={() => router.push({
                      pathname: '/course-detail',
                      params: {
                        courseId: course.id,
                        courseName: courseData.name,
                        courseCode: courseData.code || 'N/A',
                        instructorName: teacherName,
                        role: role,
                        isArchived: isArchived ? 'true' : 'false'
                      }
                    })}
                  >
                    <View style={styles.courseHeader}>
                      <Text style={[styles.courseName, isArchived && styles.archivedText]}>
                        {courseData.name}
                        {isArchived && ' (Archived)'}
                      </Text>
                      <View style={styles.subtleActionsGroup}>
                        <View style={[styles.roleTag, styles.adminCourseTag]}>
                          <Text style={styles.roleTagText}>Admin View</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.courseDetail}>
                      <Text style={styles.courseLabel}>Course Code:</Text>
                      <Text style={styles.courseValue}>{courseData.code || 'N/A'}</Text>
                    </View>
                    <View style={styles.courseDetail}>
                      <Text style={styles.courseLabel}>Description:</Text>
                      <Text style={styles.courseValue}>{courseData.description || 'No description'}</Text>
                    </View>
                    <View style={styles.courseDetail}>
                      <Text style={styles.courseLabel}>Instructor:</Text>
                      <Text style={styles.courseValue}>{teacherName}</Text>
                    </View>
                    <View style={styles.courseDetail}>
                      <Text style={styles.courseLabel}>Created:</Text>
                      <Text style={styles.courseValue}>
                        {courseData.createdAt ? new Date(courseData.createdAt).toLocaleDateString() : 'N/A'}
                      </Text>
                    </View>
                    {isArchived && (
                      <View style={styles.courseDetail}>
                        <Text style={styles.courseLabel}>Archived:</Text>
                        <Text style={styles.courseValue}>
                          {courseData.archivedAt ? new Date(courseData.archivedAt).toLocaleDateString() : 'N/A'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
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

      {role === 'admin' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(tabs)/analytics')}
        >
          <Ionicons name="bar-chart" size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  menuButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholder: {
    width: 50,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#81171b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#81171b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
    justifyContent: 'flex-end',
  },
  roleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'capitalize',
  },
  settingsButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseContainer: {
    marginBottom: 24,
  },
  courseBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderLeftWidth: 5,
    borderLeftColor: '#81171b',
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  courseName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#81171b',
    marginBottom: 0,
    letterSpacing: -0.5,
    flex: 1,
    marginRight: 12,
  },
  courseDetail: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseLabel: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 0,
    marginRight: 8,
    fontWeight: '600',
    minWidth: 100,
  },
  courseValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
    flex: 1,
  },
  noCourseBox: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    marginBottom: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  noCourseText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#81171b',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#81171b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fab: {
    position: 'absolute',
    bottom: 120,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#81171b',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#81171b',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  subtleActionButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginLeft: 4,
  },
  subtleActionsGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
    minWidth: 80,
  },
  welcomeSection: {
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#81171b',
    marginBottom: 8,
  },
  welcomeSubtext: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '500',
  },
  archivedCourseBox: {
    opacity: 0.7,
    borderLeftColor: '#6b7280',
  },
  archivedText: {
    color: '#6b7280',
  },
  adminCourseTag: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
});