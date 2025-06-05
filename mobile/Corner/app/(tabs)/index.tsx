import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs, getDoc, doc, DocumentReference } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [studentCourses, setStudentCourses] = useState<any[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        router.replace('/(auth)/login');
        return;
      }

      // 🔎 Get user role from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setRole(userData.role);

        // If student, get all their courses
        if (userData.role === 'student' && userData.courseIds) {
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
        }

        // 📚 Get all courses created by teacher
        if (userData.role === 'teacher') {
          const q = query(collection(db, 'courses'), where('teacherId', '==', user.uid));
          const snapshot = await getDocs(q);
          const coursesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCourses(coursesList);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
              <View key={course.id} style={styles.courseBox}>
                <Text style={styles.courseName}>{course.name}</Text>
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
              </View>
            ))
          ) : role === 'teacher' && courses.length > 0 ? (
            courses.map((course) => (
              <View key={course.id} style={styles.courseBox}>
                <Text style={styles.courseName}>{course.name}</Text>
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
  courseBox: {
    backgroundColor: '#e0e0e0',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
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
});
