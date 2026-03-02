import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const viewer = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : 'skip');

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/');
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  if (isLoading || viewer === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated || !viewer) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Please sign in to view your profile</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/auth/login')}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{viewer.email || 'Not set'}</Text>
      </View>

      {viewer.name && (
        <View style={styles.section}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{viewer.name}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Member Since</Text>
        <Text style={styles.value}>
          {viewer.createdAt ? new Date(viewer.createdAt).toLocaleDateString() : 'Unknown'}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    color: '#333',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    marginTop: 32,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
