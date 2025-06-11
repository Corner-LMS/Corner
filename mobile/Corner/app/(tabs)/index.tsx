import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert } from 'react-native';
import { auth, db } from '../../config/ firebase-config';
import { collection, query, where, getDocs, getDoc, doc, DocumentReference, updateDoc, deleteDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NotificationBadge from '../../components/NotificationBadge';
import { getSchoolById } from '@/constants/Schools';
import ConnectivityIndicator from '../../components/ConnectivityIndicator';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [studentCourses, setStudentCourses] = useState<any[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

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

      // Get school information
      if (userData.schoolId) {
        const school = getSchoolById(userData.schoolId);
        setSchoolInfo(school);
      }

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

      // 🔑 Admin can see courses from their school only
      if (userData.role === 'admin') {
        try {
          const adminSchoolId = userData.schoolId;

          if (!adminSchoolId) {
            console.warn('Admin has no school association');
            setCourses([]);
            setTeacherNames({});
          } else {
            // Get all courses and filter by admin's school
            const snapshot = await getDocs(collection(db, 'courses'));
            const allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filter courses to only show those from admin's school
            const coursesList = allCourses.filter((course: any) => course.schoolId === adminSchoolId);
            setCourses(coursesList);

            // Get teacher names for courses from admin's school only
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
          }
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

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#81171b" />
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoText}>
                    {schoolInfo?.shortName || 'LOGO'}
                  </Text>
                </View>
                <Text style={styles.schoolFullName}>
                  {schoolInfo?.name || 'Loading...'}
                </Text>
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
              <View style={styles.welcomeHeader}>
                <View style={styles.welcomeTextContainer}>
                  <Text style={styles.welcomeGreeting}>Good {getTimeOfDay()}</Text>
                  <Text style={styles.welcomeTitle}>
                    {role === 'admin' ? 'Administrative Dashboard' :
                      role === 'teacher' ? 'Teaching Dashboard' : 'Learning Dashboard'}
                  </Text>
                </View>
                <ConnectivityIndicator size="medium" showText={true} style={styles.connectivityIndicator} />
              </View>
              <Text style={styles.welcomeSubtext}>
                {role === 'admin' ? 'Monitor institutional performance and manage platform oversight' :
                  role === 'teacher' ? 'Manage your courses, track student progress, and share resources' :
                    'Access your enrolled courses, participate in discussions, and track your learning progress'}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#f1f5f9',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  schoolFullName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 6,
    maxWidth: 180,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 120,
    justifyContent: 'flex-end',
  },
  roleTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'capitalize',
  },
  settingsButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  courseContainer: {
    marginBottom: 20,
  },
  courseBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.8)',
    transform: [{ scale: 1 }],
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  courseName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 0,
    letterSpacing: -0.3,
    flex: 1,
    marginRight: 12,
    lineHeight: 28,
  },
  courseDetail: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  courseLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 0,
    marginRight: 12,
    fontWeight: '600',
    minWidth: 110,
  },
  courseValue: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  noCourseBox: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 20,
    marginBottom: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  noCourseText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4f46e5',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#4f46e5',
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
    right: 20,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#4f46e5',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  subtleActionButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginLeft: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subtleActionsGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
    minWidth: 80,
  },
  welcomeSection: {
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeTitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.2,
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
  adminButtonContainer: {
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  adminButton: {
    backgroundColor: '#4f46e5',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  connectivityIndicator: {
    marginLeft: 8,
  },
});