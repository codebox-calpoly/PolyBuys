import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { getEmailValidationError } from '@polybuys/shared';
import { useAuth } from '../../hooks/useAuth';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

const BOUNDS = {
  MIN_YEAR: 1900,
  MAX_YEAR: 9999,
};

export default function ProfileEditScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const profile = useQuery(api.profiles.getCurrentProfile, isAuthenticated ? {} : 'skip');
  const createProfile = useMutation(api.profiles.createProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('2026');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || profile === undefined) return;

    const key = profile?._id ?? 'new';
    if (loadedKey === key) return;

    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setBio(profile.bio ?? '');
      setMajor(profile.major);
      setYear(String(profile.year));
    } else {
      setMajor('');
      setYear('2026');
    }
    setLoadedKey(key);
  }, [isAuthenticated, profile, loadedKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Fprofile%2Fedit' as never);
    }
  }, [isAuthenticated, router]);

  const handleSave = async () => {
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
      } else {
        await updateProfile({
          name: trimmedName,
          email: normalizedEmail,
          bio: trimmedBio || undefined,
          major: trimmedMajor,
          year: parsedYear,
        });
      }

      Alert.alert('Profile saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      Alert.alert('Save failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated || profile === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@calpoly.edu"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell others about yourself"
            placeholderTextColor={colors.muted}
            multiline
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Major *</Text>
          <TextInput
            style={styles.input}
            value={major}
            onChangeText={setMajor}
            placeholder="Computer Science"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Graduation year *</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            placeholder="2026"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={() => void handleSave()}
          disabled={isSubmitting}
          accessibilityLabel={isSubmitting ? 'Saving profile' : 'Save profile'}
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save profile</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textDark,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    backgroundColor: colors.surface,
    color: colors.textDark,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing.sm,
  },
  saveButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.white,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
