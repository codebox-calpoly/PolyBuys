import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { getEmailValidationError } from '@polybuys/shared';
import { useAuth } from '../../hooks/useAuth';
import ProfileAvatar from '../../components/ProfileAvatar';
import { KeyboardAwareScreen } from '../../components/ui';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

const BOUNDS = {
  MIN_YEAR: 1900,
  MAX_YEAR: 9999,
};
const DEFAULT_YEAR = '2026';
const PROFILE_IMAGE_BOUNDS = {
  MAX_WIDTH: 1200,
  MAX_FILE_SIZE_MB: 5,
};

async function uploadImageToConvex(uploadUrl: string, blob: Blob): Promise<Id<'_storage'>> {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Content-Type', blob.type || 'image/jpeg');

    xhr.onerror = () => reject(new Error('Network error during image upload.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Image upload failed (${xhr.status}).`));
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText) as { storageId?: Id<'_storage'> };
        if (!parsed.storageId) {
          reject(new Error('Upload response missing storage ID.'));
          return;
        }
        resolve(parsed.storageId);
      } catch {
        reject(new Error('Upload response could not be parsed.'));
      }
    };

    xhr.send(blob);
  });
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const profile = useQuery(api.profiles.getCurrentProfile, isAuthenticated ? {} : 'skip');
  const createProfile = useMutation(api.profiles.createProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);
  const generateUploadUrl = useMutation(api.profiles.generateUploadUrl);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [picture, setPicture] = useState<Id<'_storage'> | null>(null);
  const [picturePreviewUri, setPicturePreviewUri] = useState<string | null>(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const { mappedUrls: pictureUrls } = useResolvedImageUrls(picture ? [picture] : []);
  const pictureUrl = picturePreviewUri ?? pictureUrls[0] ?? null;

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
      setPicture(profile.picture ?? null);
    } else {
      setName('');
      setEmail('');
      setBio('');
      setMajor('');
      setYear(DEFAULT_YEAR);
      setPicture(null);
    }
    setPicturePreviewUri(null);
    setLoadedKey(key);
  }, [isAuthenticated, profile, loadedKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Fprofile%2Fedit' as never);
    }
  }, [isAuthenticated, router]);

  const handlePickPicture = async () => {
    if (isUploadingPicture || isSubmitting) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow photo library access to upload a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled) {
        return;
      }

      setIsUploadingPicture(true);
      const picked = result.assets[0];

      // Re-encode first to apply EXIF orientation so landscape photos do not appear rotated.
      const normalized = await manipulateAsync(picked.uri, [], {
        compress: 1,
        format: SaveFormat.JPEG,
      });
      const resizeActions =
        normalized.width > PROFILE_IMAGE_BOUNDS.MAX_WIDTH
          ? [{ resize: { width: PROFILE_IMAGE_BOUNDS.MAX_WIDTH } }]
          : [];
      const manipulated = await manipulateAsync(normalized.uri, resizeActions, {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });

      const blob = await (await fetch(manipulated.uri)).blob();
      const maxBytes = PROFILE_IMAGE_BOUNDS.MAX_FILE_SIZE_MB * 1024 * 1024;
      if (blob.size > maxBytes) {
        throw new Error(
          `Profile image is too large after compression (max ${PROFILE_IMAGE_BOUNDS.MAX_FILE_SIZE_MB} MB).`
        );
      }

      const uploadUrl = await generateUploadUrl({});
      const storageId = await uploadImageToConvex(uploadUrl, blob);
      setPicture(storageId);
      setPicturePreviewUri(manipulated.uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload profile image';
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handleRemovePicture = () => {
    setPicture(null);
    setPicturePreviewUri(null);
  };

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
          picture: picture ?? undefined,
          major: trimmedMajor,
          year: parsedYear,
        });
      } else {
        await updateProfile({
          name: trimmedName,
          email: normalizedEmail,
          bio: trimmedBio || undefined,
          picture: picture === null ? null : picture,
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
    <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Profile picture</Text>
        <View style={styles.pictureRow}>
          {pictureUrl ? (
            <Image source={{ uri: pictureUrl }} style={styles.avatar} />
          ) : (
            <ProfileAvatar name={name} size={84} style={styles.avatar} />
          )}
          <View style={styles.pictureActions}>
            <Pressable
              style={({ pressed }) => [
                styles.pictureButton,
                pressed && styles.buttonPressed,
                isUploadingPicture && styles.buttonDisabled,
              ]}
              onPress={() => void handlePickPicture()}
              disabled={isUploadingPicture || isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={picture ? 'Change profile picture' : 'Add profile picture'}
            >
              {isUploadingPicture ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.pictureButtonText}>
                  {picture ? 'Change photo' : 'Upload photo'}
                </Text>
              )}
            </Pressable>
            {picture ? (
              <Pressable
                onPress={handleRemovePicture}
                disabled={isUploadingPicture || isSubmitting}
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.buttonPressed,
                  (isUploadingPicture || isSubmitting) && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Remove profile picture"
              >
                <Text style={styles.removeButtonText}>Remove photo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
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
          selectionColor={colors.primary}
          cursorColor={colors.primary}
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
          selectionColor={colors.primary}
          cursorColor={colors.primary}
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
          selectionColor={colors.primary}
          cursorColor={colors.primary}
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
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          keyboardType="number-pad"
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.buttonPressed,
          (isSubmitting || isUploadingPicture) && styles.buttonDisabled,
        ]}
        onPress={() => void handleSave()}
        disabled={isSubmitting || isUploadingPicture}
        accessibilityLabel={isSubmitting ? 'Saving profile' : 'Save profile'}
        accessibilityRole="button"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveButtonText}>Save profile</Text>
        )}
      </Pressable>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  field: {
    gap: spacing.xs,
  },
  pictureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pictureActions: {
    flex: 1,
    gap: spacing.xs,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.border,
  },
  pictureButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pictureButtonText: {
    ...typography.footnoteMed,
    color: colors.textDark,
    fontWeight: '600',
  },
  removeButton: {
    minHeight: 36,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  removeButtonText: {
    ...typography.footnote,
    color: colors.destructive,
    fontWeight: '600',
  },
  label: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textDark,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    backgroundColor: colors.white,
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
