import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import { getEmailValidationError } from '@polybuys/shared';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';

const BOUNDS = {
  MIN_YEAR: 1900,
  MAX_YEAR: 9999,
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const entranceStyle = useEntranceAnimation();

  const profile = useQuery(api.profiles.getCurrentProfile, isAuthenticated ? {} : 'skip');
  const createProfile = useMutation(api.profiles.createProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [loadedProfileKey, setLoadedProfileKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || profile === undefined) {
      return;
    }

    const nextKey = profile?._id ?? 'new-profile';
    if (loadedProfileKey === nextKey) {
      return;
    }

    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setBio(profile.bio ?? '');
      setMajor(profile.major);
      setYear(String(profile.year));
    } else {
      setName(user?.name ?? '');
      setEmail(user?.email ?? '');
      setBio('');
      setMajor('');
      setYear('');
    }

    setLoadedProfileKey(nextKey);
  }, [isAuthenticated, loadedProfileKey, profile, user?.email, user?.name]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    setLoadedProfileKey(null);
    setName('');
    setEmail('');
    setBio('');
    setMajor('');
    setYear('2026');
  }, [isAuthenticated]);

  const handleAuthAction = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign out';
      Alert.alert('Sign Out Failed', message);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    const trimmedName = name.trim();
    const trimmedMajor = major.trim();
    const trimmedBio = bio.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      Alert.alert('Missing field', 'Name is required.');
      return;
    }
    if (!trimmedMajor) {
      Alert.alert('Missing field', 'Major is required.');
      return;
    }

    const emailError = getEmailValidationError(normalizedEmail);
    if (emailError) {
      Alert.alert('Invalid email', emailError);
      return;
    }

    const parsedYear = Number(year);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < BOUNDS.MIN_YEAR ||
      parsedYear > BOUNDS.MAX_YEAR
    ) {
      Alert.alert(
        'Invalid year',
        `Year must be between ${BOUNDS.MIN_YEAR} and ${BOUNDS.MAX_YEAR}.`
      );
      return;
    }

    try {
      setIsSubmitting(true);

      if (!profile) {
        await createProfile({
          name: trimmedName,
          email: normalizedEmail,
          bio: trimmedBio || undefined,
          major: trimmedMajor,
          year: parsedYear,
        });
      }

      await updateProfile({
        name: trimmedName,
        email: normalizedEmail,
        bio: trimmedBio,
        major: trimmedMajor,
        year: parsedYear,
      });

      Alert.alert('Profile saved', 'Your profile has been updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      Alert.alert('Save failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusText = isLoading
    ? 'Checking your session...'
    : isAuthenticated
      ? (user?.email ?? 'Signed in')
      : 'You are currently signed out.';

  if (isAuthenticated && profile === undefined) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Animated.View style={[styles.heroCard, entranceStyle]}>
        <Text style={styles.eyebrow}>Profile</Text>
        <Text style={styles.title}>Manage your PolyBuys profile</Text>
        <Text style={styles.subtitle}>{statusText}</Text>
      </Animated.View>

      {!isAuthenticated ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sign in required</Text>
          <Text style={styles.sectionBody}>
            Sign in with your Cal Poly email to create and edit your profile details.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleAuthAction}
          >
            <Text style={styles.buttonText}>Sign in</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Editable profile fields</Text>

          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor="#9aaa9f"
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@calpoly.edu"
            placeholderTextColor="#9aaa9f"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell others about yourself"
            placeholderTextColor="#9aaa9f"
            multiline
          />

          <Text style={styles.label}>Major *</Text>
          <TextInput
            style={styles.input}
            value={major}
            onChangeText={setMajor}
            placeholder="Computer Science"
            placeholderTextColor="#9aaa9f"
          />

          <Text style={styles.label}>Year *</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            placeholder="2026"
            placeholderTextColor="#9aaa9f"
            keyboardType="number-pad"
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              isSubmitting && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              void handleSaveProfile();
            }}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? 'Saving profile...' : 'Save profile'}
            </Text>
          </Pressable>
        </View>
      )}

      {isAuthenticated && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Session</Text>
          <Text style={styles.sectionBody}>You are signed in and can post or edit listings.</Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              (isSigningOut || isLoading) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleAuthAction}
            disabled={isSigningOut || isLoading}
          >
            <Text style={styles.buttonText}>{isSigningOut ? 'Signing out...' : 'Sign out'}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f7f5',
    gap: 8,
  },
  loadingText: {
    color: '#5f7268',
    fontSize: 15,
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f7f5',
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 26,
    gap: 14,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 12,
    color: '#2a6f52',
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f2b21',
  },
  subtitle: {
    fontSize: 15,
    color: '#556a60',
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dde8e2',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#163429',
  },
  sectionBody: {
    fontSize: 14,
    color: '#5e7268',
    lineHeight: 20,
  },
  label: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#244539',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dfd9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f9fbfa',
    fontSize: 15,
    color: '#173227',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 6,
    backgroundColor: '#154734',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
