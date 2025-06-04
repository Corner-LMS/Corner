import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { auth, db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [role, setRole] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Get user role
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        setRole(userData.role);
      }

      // Get course created or joined by user
      const q = query(collection(db, 'courses'), where('teacherId', '==', user.uid));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setCourse(snapshot.docs[0].data());
      }

      setLoading(false);
    };

    fetchUserData();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#81171b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Corner 🎓</Text>
        <Text style={styles.role}>You are logged in as a {role}</Text>

        {course ? (
          <View style={styles.courseBox}>
            <Text style={styles.courseName}>{course.name}</Text>
            <View style={styles.courseDetail}>
              <Text style={styles.courseLabel}>Course Code:</Text>
              <Text style={styles.courseValue}>{course.code}</Text>
            </View>
            <View style={styles.courseDetail}>
              <Text style={styles.courseLabel}>Description:</Text>
              <Text style={styles.courseValue}>{course.description || 'No description'}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noCourseBox}>
            <Text style={styles.noCourseText}>No course found.</Text>
          </View>
        )}

        {role === 'teacher' && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(tabs)/create-course')}
          >
            <Text style={styles.buttonText}>Go to Announcements</Text>
          </TouchableOpacity>
        )}

        {role === 'student' && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.buttonText}>Join Another Course</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 100,
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
});
