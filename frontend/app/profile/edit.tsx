import { useEffect, useMemo, useRef, useState } from 'react';
import { Picker } from '@react-native-picker/picker';
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
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat } from 'expo-image-manipulator';
import { MajorPicker } from '../../components/MajorPicker';
import { formatMajorLabel, isCalPolyMajor } from '../../constants/calPolyMajors';
import {
  GRADUATION_YEAR_DEFAULT,
  getGraduationYearOptions,
  isSupportedGraduationYear,
} from '../../constants/graduationYears';
import { useAuth } from '../../hooks/useAuth';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import ProfileAvatar from '../../components/ProfileAvatar';
import { KeyboardAwareScreen } from '../../components/ui';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import { useFlash } from '../../contexts/FlashContext';
import { getUserFlowErrorMessage } from '../../lib/user-flow-errors';
import { manipulateImage } from '../../lib/imageManipulation';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

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
  fileUri: string,
  { signal, timeoutMs = PROFILE_IMAGE_BOUNDS.UPLOAD_TIMEOUT_MS }: UploadOptions = {}
): Promise<Id<'_storage'>> {
  const task = FileSystem.createUploadTask(uploadUrl, fileUri, {
    headers: {
      'Content-Type': 'image/jpeg',
    },
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  const uploadPromise = task.uploadAsync();

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const abortPromise = new Promise<never>((_, reject) => {
    const onAbort = () => {
      void task.cancelAsync().catch(() => undefined);
      reject(new Error('Image upload was cancelled.'));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      void task.cancelAsync().catch(() => undefined);
      reject(new Error('Image upload timed out. Please try again.'));
    }, timeoutMs);
  });

  let result: Awaited<typeof uploadPromise>;
  try {
    result = await Promise.race([uploadPromise, abortPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }

  if (!result) {
    throw new Error('Image upload was cancelled.');
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Image upload failed (${result.status}).`);
  }

  try {
    const parsed = JSON.parse(result.body) as { storageId?: Id<'_storage'> };
    if (!parsed.storageId) {
      throw new Error('Upload response missing storage ID.');
    }
    return parsed.storageId;
  } catch (error) {
    if (error instanceof Error && error.message === 'Upload response missing storage ID.') {
      throw error;
    }
    throw new Error('Upload response could not be parsed.');
  }
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
  const [year, setYear] = useState<string>(GRADUATION_YEAR_DEFAULT);
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
  const yearOptions = useMemo(
    () => getGraduationYearOptions({ preserveYear: profile?.year }),
    [profile?.year]
  );

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
      setYear(GRADUATION_YEAR_DEFAULT);
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
      const normalized = await manipulateImage(picked.uri, [], {
        compress: 1,
        format: SaveFormat.JPEG,
      });
      const resizeActions =
        normalized.width > PROFILE_IMAGE_BOUNDS.MAX_WIDTH
          ? [{ resize: { width: PROFILE_IMAGE_BOUNDS.MAX_WIDTH } }]
          : [];
      const manipulated = await manipulateImage(normalized.uri, resizeActions, {
        compress: 0.8,
        format: SaveFormat.JPEG,
      });

      const fileInfo = await FileSystem.getInfoAsync(manipulated.uri);
      const maxBytes = PROFILE_IMAGE_BOUNDS.MAX_FILE_SIZE_MB * 1024 * 1024;
      if (!fileInfo.exists || fileInfo.isDirectory) {
        throw new Error('Prepared profile image file is missing.');
      }
      if (fileInfo.size > maxBytes) {
        throw new Error(
          `Profile image is too large after compression (max ${PROFILE_IMAGE_BOUNDS.MAX_FILE_SIZE_MB} MB).`
        );
      }

      setPendingPictureUri(manipulated.uri);
    } catch (error) {
      setFlash(getUserFlowErrorMessage(error, 'prepare-profile-image'));
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

    if (!isSupportedGraduationYear(year, yearOptions)) {
      setFlash('Choose a graduation year from the list.');
      return;
    }
    const parsedYear = Number(year);

    try {
      setIsSubmitting(true);
      let nextPicture: Id<'_storage'> | null = picture;

      if (pendingPictureUri) {
        const uploadUrl = await generateUploadUrl({});
        uploadAbortRef.current?.abort();
        const abortController = new AbortController();
        uploadAbortRef.current = abortController;
        nextPicture = await uploadImageToConvex(uploadUrl, pendingPictureUri, {
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
      setFlash(getUserFlowErrorMessage(error, 'save-profile'));
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
        <View style={[styles.yearPickerFrame, isSubmitting && styles.yearPickerDisabled]}>
          <Picker
            selectedValue={year}
            onValueChange={(nextValue) => setYear(String(nextValue))}
            enabled={!isSubmitting}
            itemStyle={styles.yearPickerItem}
            style={styles.yearPicker}
          >
            {yearOptions.map((option) => (
              <Picker.Item key={option} label={option} value={option} color={colors.textDark} />
            ))}
          </Picker>
        </View>
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
  yearPickerFrame: {
    height: Platform.OS === 'ios' ? 168 : 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  yearPickerDisabled: {
    opacity: 0.75,
  },
  yearPicker: {
    flex: 1,
    color: colors.textDark,
  },
  yearPickerItem: {
    color: colors.textDark,
    fontSize: 20,
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
