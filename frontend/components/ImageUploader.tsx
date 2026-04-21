import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, borderRadius, typography, spacing } from '../theme/tokens';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useResolvedImageUrls } from '../hooks/useResolvedImageUrls';

interface ImageUploaderProps {
  images: string[];
  onImagesChange: Dispatch<SetStateAction<string[]>>;
  onPendingChange?: (hasPendingUploads: boolean) => void;
  maxImages?: number;
  maxFileSizeMB?: number;
}

type UploadStatus = 'uploading' | 'error';

type PendingUpload = {
  localId: string;
  uri: string;
  progress: number;
  status: UploadStatus;
  error?: string;
};

type PickedImage = {
  uri: string;
  width?: number;
  height?: number;
  isObjectUrl?: boolean;
};

function UploadProgressBar({ progress, compact = false }: { progress: number; compact?: boolean }) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const animatedProgress = useRef(new Animated.Value(clampedProgress)).current;

  useEffect(() => {
    const animation = Animated.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animatedProgress, clampedProgress]);

  const width = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.progressTrack, compact && styles.progressTrackCompact]}>
      <Animated.View
        style={[styles.progressFill, compact && styles.progressFillCompact, { width }]}
      />
    </View>
  );
}

export default function ImageUploader({
  images,
  onImagesChange,
  onPendingChange,
  maxImages = 8,
  maxFileSizeMB = 5,
}: ImageUploaderProps) {
  const generateUploadUrl = useMutation(api.listings.generateListingImageUploadUrl);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const objectUrlByLocalIdRef = useRef<Record<string, string>>({});
  const { mappedUrls } = useResolvedImageUrls(images);

  useEffect(() => {
    onPendingChange?.(pendingUploads.some((upload) => upload.status === 'uploading'));
  }, [onPendingChange, pendingUploads]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web') {
        return;
      }
      for (const objectUrl of Object.values(objectUrlByLocalIdRef.current)) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrlByLocalIdRef.current = {};
    };
  }, []);

  function revokeObjectUrl(localId: string) {
    if (Platform.OS !== 'web') {
      return;
    }
    const objectUrl = objectUrlByLocalIdRef.current[localId];
    if (!objectUrl) {
      return;
    }
    URL.revokeObjectURL(objectUrl);
    delete objectUrlByLocalIdRef.current[localId];
  }

  async function getWebImageDimensions(uri: string) {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => reject(new Error('Unable to determine image dimensions.'));
      image.src = uri;
    });
  }

  async function pickUsingWebInput() {
    const element = document.createElement('input');
    element.type = 'file';
    element.accept = 'image/*';
    element.multiple = false;

    return await new Promise<PickedImage | null>((resolve) => {
      element.onchange = async () => {
        const file = element.files?.[0];
        if (!file) {
          element.onchange = null;
          resolve(null);
          return;
        }
        const objectUrl = URL.createObjectURL(file);
        element.onchange = null;
        try {
          const dimensions = await getWebImageDimensions(objectUrl);
          resolve({ uri: objectUrl, isObjectUrl: true, ...dimensions });
        } catch {
          resolve({ uri: objectUrl, isObjectUrl: true });
        }
      };
      element.click();
    });
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled) {
      return null;
    }

    return {
      uri: result.assets[0].uri,
      width: result.assets[0].width,
      height: result.assets[0].height,
    };
  }

  async function pickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow camera access.');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled) {
      return null;
    }

    return {
      uri: result.assets[0].uri,
      width: result.assets[0].width,
      height: result.assets[0].height,
    };
  }

  async function compressAndValidate(picked: PickedImage) {
    let workingUri = picked.uri;
    let originalWidth = picked.width;
    let originalHeight = picked.height;

    // Normalize Android image orientation/dimensions before deciding resize.
    if (Platform.OS === 'android' || !originalWidth || !originalHeight) {
      const normalized = await manipulateAsync(workingUri, [], {
        compress: 1,
        format: SaveFormat.JPEG,
      });
      workingUri = normalized.uri;
      originalWidth = normalized.width;
      originalHeight = normalized.height;
    }

    if (!originalWidth || !originalHeight) {
      throw new Error('Unable to determine image dimensions.');
    }

    const targetWidth = Math.min(originalWidth, 1200);
    const actions = targetWidth < originalWidth ? [{ resize: { width: targetWidth } }] : [];

    const manipulated = await manipulateAsync(workingUri, actions, {
      compress: 0.8,
      format: SaveFormat.JPEG,
    });

    const blobResponse = await fetch(manipulated.uri);
    const blob = await blobResponse.blob();

    const maxBytes = maxFileSizeMB * 1024 * 1024;
    if (blob.size > maxBytes) {
      throw new Error(`Image is too large after compression (max ${maxFileSizeMB} MB).`);
    }

    return {
      blob,
      uri: manipulated.uri,
    };
  }

  async function uploadToConvex(blob: Blob, onProgress: (progress: number) => void) {
    const uploadUrl = await generateUploadUrl({});

    return await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Content-Type', blob.type || 'image/jpeg');

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }
        onProgress(event.loaded / event.total);
      };

      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Upload failed (${xhr.status}).`));
          return;
        }

        try {
          const parsed = JSON.parse(xhr.responseText) as { storageId?: string };
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

  function removeImage(imageId: string) {
    onImagesChange((prev) => prev.filter((id) => id !== imageId));
  }

  async function startUpload(picked: PickedImage, localId: string) {
    try {
      const compressed = await compressAndValidate(picked);
      const storageId = await uploadToConvex(compressed.blob, (progress) => {
        setPendingUploads((prev) =>
          prev.map((upload) => (upload.localId === localId ? { ...upload, progress } : upload))
        );
      });

      setPendingUploads((prev) =>
        prev.map((upload) => (upload.localId === localId ? { ...upload, progress: 1 } : upload))
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
      setPendingUploads((prev) => prev.filter((upload) => upload.localId !== localId));
      revokeObjectUrl(localId);
      onImagesChange((prev) => [...prev, storageId]);
    } catch (error) {
      setPendingUploads((prev) =>
        prev.map((upload) =>
          upload.localId === localId
            ? {
                ...upload,
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : upload
        )
      );
    }
  }

  async function handlePickAndUpload(picker: () => Promise<PickedImage | null>) {
    const picked = await picker();
    if (!picked) {
      return;
    }
    const localId = `pending-${Date.now()}`;
    setPendingUploads((prev) => [
      ...prev,
      {
        localId,
        uri: picked.uri,
        progress: 0,
        status: 'uploading',
      },
    ]);
    await startUpload(picked, localId);
  }

  async function addImage() {
    if (images.length + pendingUploads.length >= maxImages) {
      Alert.alert('Maximum reached', `You can only upload up to ${maxImages} images.`);
      return;
    }

    if (Platform.OS === 'web') {
      const picked = await pickUsingWebInput();
      if (!picked) {
        return;
      }

      const localId = `pending-${Date.now()}`;
      if (picked.isObjectUrl) {
        objectUrlByLocalIdRef.current[localId] = picked.uri;
      }
      setPendingUploads((prev) => [
        ...prev,
        {
          localId,
          uri: picked.uri,
          progress: 0,
          status: 'uploading',
        },
      ]);
      await startUpload(picked, localId);
      return;
    }

    Alert.alert('Add image', 'Choose image source', [
      {
        text: 'Camera',
        onPress: () => {
          void (async () => {
            await handlePickAndUpload(pickFromCamera);
          })();
        },
      },
      {
        text: 'Photo Library',
        onPress: () => {
          void (async () => {
            await handlePickAndUpload(pickFromLibrary);
          })();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function retryUpload(localId: string) {
    const failed = pendingUploads.find((item) => item.localId === localId);
    if (!failed) {
      return;
    }

    setPendingUploads((prev) =>
      prev.map((upload) =>
        upload.localId === localId
          ? { ...upload, progress: 0, status: 'uploading', error: undefined }
          : upload
      )
    );
    void startUpload({ uri: failed.uri }, localId);
  }

  function removePending(localId: string) {
    revokeObjectUrl(localId);
    setPendingUploads((prev) => prev.filter((item) => item.localId !== localId));
  }

  const isEmpty = images.length === 0 && pendingUploads.length === 0;
  const count = images.length + pendingUploads.length;
  const atMax = count >= maxImages;
  const activelyUploading = pendingUploads.filter((upload) => upload.status === 'uploading');
  const uploadCount = activelyUploading.length;
  const overallUploadProgress =
    uploadCount > 0
      ? activelyUploading.reduce((sum, upload) => sum + upload.progress, 0) / uploadCount
      : 0;

  return (
    <View>
      {uploadCount > 0 ? (
        <View style={styles.uploadStatusCard}>
          <View style={styles.uploadStatusHeader}>
            <Text style={styles.uploadStatusTitle}>
              Uploading {uploadCount} {uploadCount === 1 ? 'photo' : 'photos'}
            </Text>
            <Text style={styles.uploadStatusPercent}>
              {Math.round(overallUploadProgress * 100)}%
            </Text>
          </View>
          <UploadProgressBar progress={overallUploadProgress} />
        </View>
      ) : null}
      {isEmpty ? (
        <Pressable
          style={({ pressed }) => [styles.heroUpload, pressed && styles.heroUploadPressed]}
          onPress={() => void addImage()}
          accessibilityLabel="Add photos"
          accessibilityRole="button"
        >
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>📷</Text>
          </View>
          <Text style={styles.heroTitle}>Add photos</Text>
          <Text style={styles.heroSubtitle}>
            Tap to upload from camera or library • 1–{maxImages} photos
          </Text>
        </Pressable>
      ) : (
        <View style={styles.grid}>
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              atMax && styles.addButtonDisabled,
              pressed && !atMax && styles.addButtonPressed,
            ]}
            onPress={() => void addImage()}
            disabled={atMax}
            accessibilityLabel={
              atMax ? 'Maximum photos reached' : `Add photo (${count}/${maxImages})`
            }
            accessibilityRole="button"
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>
              {atMax ? `${maxImages}/${maxImages}` : `Add (${count}/${maxImages})`}
            </Text>
          </Pressable>
          {images.map((imageId, index) => (
            <View key={imageId} style={styles.card}>
              {mappedUrls[index] ? (
                <Image source={{ uri: mappedUrls[index] as string }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Text style={styles.placeholderText}>Loading...</Text>
                </View>
              )}
              <Pressable style={styles.removeButton} onPress={() => removeImage(imageId)}>
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}

          {pendingUploads.map((upload) => (
            <View key={upload.localId} style={styles.card}>
              <Image source={{ uri: upload.uri }} style={styles.image} />
              <View style={styles.pendingOverlay}>
                {upload.status === 'uploading' ? (
                  <View style={styles.pendingContent}>
                    <Text style={styles.pendingText}>
                      Uploading {Math.round(upload.progress * 100)}%
                    </Text>
                    <UploadProgressBar progress={upload.progress} compact />
                  </View>
                ) : (
                  <Text style={styles.errorText}>Failed</Text>
                )}
              </View>

              {upload.status === 'error' ? (
                <View style={styles.errorActions}>
                  <Pressable style={styles.smallButton} onPress={() => retryUpload(upload.localId)}>
                    <Text style={styles.smallButtonText}>Retry</Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallButton}
                    onPress={() => removePending(upload.localId)}
                  >
                    <Text style={styles.smallButtonText}>Remove</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  uploadStatusCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  uploadStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadStatusTitle: {
    ...typography.footnoteMed,
    color: colors.textDark,
    fontWeight: '600',
  },
  uploadStatusPercent: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressTrackCompact: {
    height: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  progressFillCompact: {
    backgroundColor: colors.white,
    opacity: 0.95,
  },
  heroUpload: {
    minHeight: 180,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.placeholderBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    boxShadow: '0 12px 28px rgba(21, 71, 52, 0.08)',
  },
  heroUploadPressed: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    opacity: 0.95,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroIconText: {
    fontSize: 28,
  },
  heroTitle: {
    ...typography.heading,
    color: colors.textDark,
  },
  heroSubtitle: {
    ...typography.footnote,
    color: colors.muted,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  addButton: {
    width: 140,
    height: 140,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.placeholderBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    boxShadow: '0 10px 22px rgba(21, 71, 52, 0.08)',
  },
  addButtonPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  addButtonDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    opacity: 0.7,
  },
  addButtonIcon: {
    fontSize: 32,
    color: colors.primary,
    fontWeight: '300',
    lineHeight: 36,
  },
  addButtonText: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: '600',
  },
  card: {
    width: 140,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.grayLight,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: colors.gray,
  },
  removeButton: {
    marginTop: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(179, 38, 30, 0.18)',
    backgroundColor: 'rgba(179, 38, 30, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.destructive,
    fontSize: 12,
    fontWeight: '600',
  },
  pendingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 26,
    left: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingContent: {
    width: '78%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pendingText: {
    color: colors.white,
    fontWeight: '700',
  },
  errorText: {
    color: colors.errorText,
    fontWeight: '700',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  smallButton: {
    flex: 1,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});
