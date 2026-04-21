import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { MajorPicker } from '../../components/MajorPicker';
import { formatMajorLabel, isCalPolyMajor } from '../../constants/calPolyMajors';
import { useAuth } from '../../hooks/useAuth';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import ProfileAvatar from '../../components/ProfileAvatar';
import { KeyboardAwareScreen } from '../../components/ui';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import { useFlash } from '../../contexts/FlashContext';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

const BOUNDS = {
  MIN_YEAR: 1900,
  MAX_YEAR: 9999,
};
const DEFAULT_YEAR = '2026';
const PROFILE_IMAGE_BOUNDS = {
  MAX_WIDTH: 1200,
  MAX_FILE_SIZE_MB: 5,
  UPLOAD_TIMEOUT_MS: 20000,
};

type UploadOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

async function uploadImageToConvex(
  uploadUrl: string,
  blob: Blob,
  { signal, timeoutMs = PROFILE_IMAGE_BOUNDS.UPLOAD_TIMEOUT_MS }: UploadOptions = {}
): Promise<Id<'_storage'>> {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const resolveOnce = (value: Id<'_storage'>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onAbort = () => {
      try {
        xhr.abort();
      } catch {
        // no-op
      }
      rejectOnce(new Error('Image upload was cancelled.'));
    };
    const cleanup = () => {
      xhr.onerror = null;
      xhr.onload = null;
      xhr.onabort = null;
      xhr.ontimeout = null;
      signal?.removeEventListener('abort', onAbort);
    };

    if (signal?.aborted) {
      rejectOnce(new Error('Image upload was cancelled.'));
      return;
    }

    xhr.open('POST', uploadUrl);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Content-Type', blob.type || 'image/jpeg');

    xhr.onerror = () => rejectOnce(new Error('Network error during image upload.'));
    xhr.onabort = () => rejectOnce(new Error('Image upload was cancelled.'));
    xhr.ontimeout = () => rejectOnce(new Error('Image upload timed out. Please try again.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        rejectOnce(new Error(`Image upload failed (${xhr.status}).`));
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText) as { storageId?: Id<'_storage'> };
        if (!parsed.storageId) {
          rejectOnce(new Error('Upload response missing storage ID.'));
          return;
        }
        resolveOnce(parsed.storageId);
      } catch {
        rejectOnce(new Error('Upload response could not be parsed.'));
      }
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    xhr.send(blob);
  });
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const { user, isAuthenticated, isUserLoading } = useAuth();
  const { setFlash } = useFlash();
  const profile = useQuery(api.profiles.getCurrentProfile, isAuthenticated && !isWeb ? {} : 'skip');
  const createProfile = useMutation(api.profiles.createProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);
  const generateUploadUrl = useMutation(api.profiles.generateUploadUrl);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [picture, setPicture] = useState<Id<'_storage'> | null>(null);
  const [pendingPictureUri, setPendingPictureUri] = useState<string | null>(null);
  const [isPreparingPicture, setIsPreparingPicture] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMajorPickerVisible, setIsMajorPickerVisible] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const { mappedUrls: pictureUrls } = useResolvedImageUrls(picture ? [picture] : []);
  const pictureUrl = pendingPictureUri ?? pictureUrls[0] ?? null;
  const profileEmail = profile?.email ?? user?.email ?? '';
  const isScreenLoading = !isAuthenticated || profile === undefined || (!profile && isUserLoading);

  useEffect(() => {
    if (!isAuthenticated || profile === undefined) return;

    const key = profile?._id ?? 'new';
    if (loadedKey === key) return;

    if (profile) {
      setName(profile.name);
      setBio(profile.bio ?? '');
      setMajor(profile.major);
      setYear(String(profile.year));
      setPicture(profile.picture ?? null);
    } else {
      setName('');
      setBio('');
      setMajor('');
      setYear(DEFAULT_YEAR);
      setPicture(null);
    }
    setPendingPictureUri(null);
    setLoadedKey(key);
  }, [isAuthenticated, profile, loadedKey]);

  useEffect(() => {
    if (!isWeb && !isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Fprofile%2Fedit' as never);
    }
  }, [isAuthenticated, isWeb, router]);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
      uploadAbortRef.current = null;
    };
  }, []);

  const handlePickPicture = async () => {
    if (isPreparingPicture || isSubmitting) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFlash('Photo library permission is required to upload a profile picture.');
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

      setIsPreparingPicture(true);
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

      setPendingPictureUri(manipulated.uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to prepare profile image';
      setFlash(message);
    } finally {
      setIsPreparingPicture(false);
    }
  };

  const handleRemovePicture = () => {
    setPicture(null);
    setPendingPictureUri(null);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedMajor = major.trim();
    const trimmedBio = bio.trim();
    const normalizedEmail = profileEmail.trim().toLowerCase();

    if (!trimmedName) {
      setFlash('Name is required.');
      return;
    }
    if (!trimmedMajor) {
      setFlash('Choose your major from the official Cal Poly majors list.');
      return;
    }
    if (!isCalPolyMajor(trimmedMajor)) {
      setFlash('Choose your major from the official Cal Poly majors list.');
      return;
    }

    if (normalizedEmail) {
      const emailError = getEmailValidationError(normalizedEmail);
      if (emailError) {
        setFlash(emailError);
        return;
      }
    }

    const parsedYear = Number(year);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < BOUNDS.MIN_YEAR ||
      parsedYear > BOUNDS.MAX_YEAR
    ) {
      setFlash(`Year must be between ${BOUNDS.MIN_YEAR} and ${BOUNDS.MAX_YEAR}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      let nextPicture: Id<'_storage'> | null = picture;

      if (pendingPictureUri) {
        const blob = await (await fetch(pendingPictureUri)).blob();
        const uploadUrl = await generateUploadUrl({});
        uploadAbortRef.current?.abort();
        const abortController = new AbortController();
        uploadAbortRef.current = abortController;
        nextPicture = await uploadImageToConvex(uploadUrl, blob, {
          signal: abortController.signal,
        });
        uploadAbortRef.current = null;
      }

      if (!profile) {
        await createProfile({
          name: trimmedName,
          bio: trimmedBio || undefined,
          picture: nextPicture ?? undefined,
          major: trimmedMajor,
          year: parsedYear,
        });
      } else {
        await updateProfile({
          name: trimmedName,
          bio: trimmedBio || undefined,
          picture: nextPicture,
          major: trimmedMajor,
          year: parsedYear,
        });
      }

      setPicture(nextPicture);
      setPendingPictureUri(null);
      Alert.alert('Profile saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      uploadAbortRef.current = null;
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      setFlash(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isWeb) {
    return (
      <OpenInAppPrompt
        title="Edit your profile in the mobile app"
        body="Profile editing is available in the PolyBuys mobile app."
        path="/profile/edit"
        buttonLabel="Open Profile Editor in App"
        secondaryActionLabel="Back to home"
        onSecondaryAction={() => router.replace('/')}
      />
    );
  }

  if (isScreenLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const selectedMajorLabel = major ? formatMajorLabel(major) : '';
  const hasInvalidMajorSelection = major.length > 0 && !isCalPolyMajor(major);

  return (
    <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Profile picture</Text>
        <View style={styles.pictureRow}>
          <ProfileAvatar uri={pictureUrl} name={name} size={84} style={styles.avatar} />
          <View style={styles.pictureActions}>
            <Pressable
              style={({ pressed }) => [
                styles.pictureButton,
                pressed && styles.buttonPressed,
                isPreparingPicture && styles.buttonDisabled,
              ]}
              onPress={() => void handlePickPicture()}
              disabled={isPreparingPicture || isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={pictureUrl ? 'Change profile picture' : 'Add profile picture'}
            >
              {isPreparingPicture ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.pictureButtonText}>
                  {pictureUrl ? 'Change photo' : 'Upload photo'}
                </Text>
              )}
            </Pressable>
            {pictureUrl ? (
              <Pressable
                onPress={handleRemovePicture}
                disabled={isPreparingPicture || isSubmitting}
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed && styles.buttonPressed,
                  (isPreparingPicture || isSubmitting) && styles.buttonDisabled,
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
        <Text style={styles.label}>Cal Poly email *</Text>
        <View style={[styles.input, styles.readOnlyInput]}>
          <Text selectable style={styles.readOnlyValue}>
            {profileEmail || 'Email unavailable'}
          </Text>
        </View>
        <Text selectable style={styles.helperText}>
          Your campus email is managed by your sign-in and can&apos;t be changed here.
        </Text>
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
        <Pressable
          style={({ pressed }) => [
            styles.input,
            styles.selectionInput,
            pressed && styles.buttonPressed,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={() => setIsMajorPickerVisible(true)}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={
            selectedMajorLabel ? `Selected major ${selectedMajorLabel}` : 'Select major'
          }
        >
          <Text
            style={[
              styles.selectionInputText,
              !major && styles.selectionInputPlaceholder,
              hasInvalidMajorSelection && styles.selectionInputWarning,
            ]}
            numberOfLines={1}
          >
            {selectedMajorLabel || 'Search and select your major'}
          </Text>
        </Pressable>
        {hasInvalidMajorSelection ? (
          <Text style={styles.helperText}>
            Please reselect your major from the official Cal Poly majors list before saving.
          </Text>
        ) : null}
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
          (isSubmitting || isPreparingPicture) && styles.buttonDisabled,
        ]}
        onPress={() => void handleSave()}
        disabled={isSubmitting || isPreparingPicture}
        accessibilityLabel={isSubmitting ? 'Saving profile' : 'Save profile'}
        accessibilityRole="button"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.saveButtonText}>Save profile</Text>
        )}
      </Pressable>
      <MajorPicker
        visible={isMajorPickerVisible}
        selectedMajor={isCalPolyMajor(major) ? major : undefined}
        onSelect={setMajor}
        onClose={() => setIsMajorPickerVisible(false)}
      />
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
  },
  pictureButton: {
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.16)',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    boxShadow: '0 8px 18px rgba(21, 71, 52, 0.08)',
  },
  pictureButtonText: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '600',
  },
  removeButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(179, 38, 30, 0.18)',
    backgroundColor: 'rgba(179, 38, 30, 0.06)',
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
  selectionInput: {
    minHeight: 52,
    justifyContent: 'center',
  },
  selectionInputText: {
    ...typography.body,
    color: colors.textDark,
  },
  selectionInputPlaceholder: {
    color: colors.muted,
  },
  selectionInputWarning: {
    color: colors.warningText,
  },
  readOnlyInput: {
    minHeight: 52,
    justifyContent: 'center',
    backgroundColor: colors.placeholderBg,
  },
  readOnlyValue: {
    ...typography.body,
    color: colors.textDark,
  },
  helperText: {
    ...typography.footnote,
    color: colors.gray,
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
    boxShadow: '0 14px 28px rgba(21, 71, 52, 0.18)',
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
