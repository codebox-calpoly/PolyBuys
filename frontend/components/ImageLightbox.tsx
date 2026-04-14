import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export default function ImageLightbox({
  images,
  initialIndex = 0,
  visible,
  onClose,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Sync index when the lightbox opens with a new initialIndex
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  // Auto-focus the overlay on web so keyboard events are captured immediately
  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (overlayRef.current as any)?.focus();
    }
  }, [visible]);

  if (!visible || images.length === 0) {
    return null;
  }

  const hasMultiple = images.length > 1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goToPrevious = () => {
    if (hasPrevious) setCurrentIndex((i) => i - 1);
  };

  const goToNext = () => {
    if (hasNext) setCurrentIndex((i) => i + 1);
  };

  // Handle keyboard navigation on web
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  };

  const imageUri = images[currentIndex];

  const webProps =
    Platform.OS === 'web'
      ? {
          onKeyDown: handleKeyDown,
          tabIndex: 0,
        }
      : {};

  const content = (
    <View ref={overlayRef as any} style={styles.overlay} {...(webProps as any)}>
      {/* Backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close image viewer"
      />

      {/* Close button */}
      <Pressable
        style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
        onPress={onClose}
        accessibilityLabel="Close"
        accessibilityRole="button"
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      {/* Image */}
      <View
        style={[
          styles.imageContainer,
          {
            maxWidth: screenWidth * 0.9,
            maxHeight: screenHeight * 0.85,
          },
        ]}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={`Image ${currentIndex + 1} of ${images.length}`}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Image unavailable</Text>
          </View>
        )}
      </View>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.arrow,
              styles.arrowLeft,
              !hasPrevious && styles.arrowDisabled,
              pressed && hasPrevious && styles.arrowPressed,
            ]}
            onPress={goToPrevious}
            disabled={!hasPrevious}
            accessibilityLabel="Previous image"
            accessibilityRole="button"
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.arrow,
              styles.arrowRight,
              !hasNext && styles.arrowDisabled,
              pressed && hasNext && styles.arrowPressed,
            ]}
            onPress={goToNext}
            disabled={!hasNext}
            accessibilityLabel="Next image"
            accessibilityRole="button"
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </>
      )}

      {/* Indicators */}
      {hasMultiple && (
        <View style={styles.indicators}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
          <View style={styles.dotsRow}>
            {images.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setCurrentIndex(i)}
                style={[styles.dot, i === currentIndex ? styles.dotActive : styles.dotInactive]}
                accessibilityLabel={`Go to image ${i + 1}`}
                accessibilityRole="button"
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );

  // On web use a plain portal-style overlay; on native use Modal
  if (Platform.OS === 'web') {
    return content;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  closeButtonText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '600',
  },
  imageContainer: {
    width: '90%',
    height: '85%',
    zIndex: 5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.subhead,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    zIndex: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: {
    left: 16,
  },
  arrowRight: {
    right: 16,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  arrowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  arrowText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 28,
  },
  indicators: {
    position: 'absolute',
    bottom: 24,
    zIndex: 10,
    alignItems: 'center',
    gap: spacing.sm,
  },
  counterText: {
    ...typography.footnote,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.white,
  },
  dotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
