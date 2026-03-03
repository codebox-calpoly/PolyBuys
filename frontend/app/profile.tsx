import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';

const CAL_POLY_YEARS = [1, 2, 3, 4, 5] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const viewer = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : 'skip');
  const profile = useQuery(api.profiles.getMyProfile, isAuthenticated ? {} : 'skip');
  const createProfile = useMutation(api.profiles.createProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);

  // Create-form state
  const [createName, setCreateName] = useState('');
  const [createMajor, setCreateMajor] = useState('');
  const [createYear, setCreateYear] = useState('1');
  const [createBio, setCreateBio] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit-mode state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMajor, setEditMajor] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleCreate = async () => {
    const year = parseInt(createYear, 10);
    if (!createName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (!createMajor.trim()) {
      Alert.alert('Required', 'Please enter your major.');
      return;
    }
    if (isNaN(year) || year < 1 || year > 5) {
      Alert.alert('Invalid year', 'Year must be between 1 and 5.');
      return;
    }
    setIsCreating(true);
    try {
      await createProfile({
        name: createName.trim(),
        major: createMajor.trim(),
        year,
        bio: createBio.trim() || undefined,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create profile.');
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditMajor(profile.major);
    setEditYear(String(profile.year));
    setEditBio(profile.bio ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    const year = parseInt(editYear, 10);
    if (!editName.trim()) {
      Alert.alert('Required', 'Name cannot be empty.');
      return;
    }
    if (!editMajor.trim()) {
      Alert.alert('Required', 'Major cannot be empty.');
      return;
    }
    if (isNaN(year) || year < 1 || year > 5) {
      Alert.alert('Invalid year', 'Year must be between 1 and 5.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({
        name: editName.trim(),
        major: editMajor.trim(),
        year,
        bio: editBio.trim() || undefined,
      });
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || viewer === undefined || profile === undefined) {
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

  // No profile yet — show creation form
  if (profile === null) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Required to list items on PolyBuys.</Text>

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={createName}
          onChangeText={setCreateName}
          placeholder="Your full name"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Major *</Text>
        <TextInput
          style={styles.input}
          value={createMajor}
          onChangeText={setCreateMajor}
          placeholder="e.g. Computer Science"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Year *</Text>
        <View style={styles.yearRow}>
          {CAL_POLY_YEARS.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.yearChip, createYear === String(y) && styles.yearChipSelected]}
              onPress={() => setCreateYear(String(y))}
            >
              <Text
                style={[
                  styles.yearChipText,
                  createYear === String(y) && styles.yearChipTextSelected,
                ]}
              >
                {y === 5 ? '5+' : String(y)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Bio (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={createBio}
          onChangeText={setCreateBio}
          placeholder="A little about yourself..."
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.primaryButton, isCreating && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isCreating}
        >
          <Text style={styles.primaryButtonText}>
            {isCreating ? 'Creating...' : 'Create Profile'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Profile exists — show profile with optional edit mode
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        {!editing && (
          <TouchableOpacity style={styles.editChip} onPress={startEditing}>
            <Text style={styles.editChipText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Major</Text>
          <TextInput
            style={styles.input}
            value={editMajor}
            onChangeText={setEditMajor}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Year</Text>
          <View style={styles.yearRow}>
            {CAL_POLY_YEARS.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.yearChip, editYear === String(y) && styles.yearChipSelected]}
                onPress={() => setEditYear(String(y))}
              >
                <Text
                  style={[
                    styles.yearChipText,
                    editYear === String(y) && styles.yearChipTextSelected,
                  ]}
                >
                  {y === 5 ? '5+' : String(y)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={editBio}
            onChangeText={setEditBio}
            multiline
            numberOfLines={3}
            placeholder="A little about yourself..."
          />

          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.flex1, isSaving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, styles.flex1]}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Email</Text>
            <Text style={styles.value}>{viewer.email ?? 'Not set'}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Name</Text>
            <Text style={styles.value}>{profile.name}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Major</Text>
            <Text style={styles.value}>{profile.major}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Year</Text>
            <Text style={styles.value}>{profile.year === 5 ? '5+' : String(profile.year)}</Text>
          </View>
          {profile.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Bio</Text>
              <Text style={styles.value}>{profile.bio}</Text>
            </View>
          ) : null}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Member Since</Text>
            <Text style={styles.value}>{new Date(profile.joinDate).toLocaleDateString()}</Text>
          </View>
        </>
      )}

      {!editing && (
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  editChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  editChipText: {
    color: '#1976d2',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#222',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  yearRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fafafa',
  },
  yearChipSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  yearChipText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  yearChipTextSelected: {
    color: '#fff',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#9e9e9e',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  cancelButtonText: {
    color: '#444',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  flex1: {
    flex: 1,
  },
});
