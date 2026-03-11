import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useResolvedImageUrls } from '../hooks/useResolvedImageUrls';
import { getConvexErrorDisplay } from '../lib/convexError';

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

      setPendingUploads((prev) => prev.filter((upload) => upload.localId !== localId));
      revokeObjectUrl(localId);
      onImagesChange((prev) => [...prev, storageId]);
    } catch (error) {
      const { message } = getConvexErrorDisplay(error, 'Upload failed');
      setPendingUploads((prev) =>
        prev.map((upload) =>
          upload.localId === localId ? { ...upload, status: 'error', error: message } : upload
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

  return (
    <View>
      <View style={styles.grid}>
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
                <Text style={styles.pendingText}>{Math.round(upload.progress * 100)}%</Text>
              ) : (
                <Text style={styles.errorText}>Failed</Text>
              )}
            </View>

            {upload.status === 'error' ? (
              <View style={styles.errorActions}>
                <Pressable style={styles.smallButton} onPress={() => retryUpload(upload.localId)}>
                  <Text style={styles.smallButtonText}>Retry</Text>
                </Pressable>
                <Pressable style={styles.smallButton} onPress={() => removePending(upload.localId)}>
                  <Text style={styles.smallButtonText}>Remove</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <Pressable
        style={[
          styles.addButton,
          images.length + pendingUploads.length >= maxImages && styles.addButtonDisabled,
        ]}
        onPress={() => {
          void addImage();
        }}
        disabled={images.length + pendingUploads.length >= maxImages}
      >
        <Text style={styles.addButtonText}>Add Image</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '31%',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#eaeaea',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#666',
  },
  removeButton: {
    marginTop: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#ef5350',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
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
  pendingText: {
    color: '#fff',
    fontWeight: '700',
  },
  errorText: {
    color: '#ffdede',
    fontWeight: '700',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  smallButton: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#455a64',
    alignItems: 'center',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1976d2',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#9e9e9e',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
