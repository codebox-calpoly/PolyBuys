import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const [isZoomed, setIsZoomed] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imageScale = useRef(new Animated.Value(1)).current;
  const imageTranslateX = useRef(new Animated.Value(0)).current;
  const imageTranslateY = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const gestureStartScale = useRef(1);
  const gestureStartTranslate = useRef({ x: 0, y: 0 });
  const pinchStartDistance = useRef(0);
  const activeGesture = useRef<'none' | 'pan' | 'pinch'>('none');
  const panStartPoint = useRef({ x: 0, y: 0 });

  const minScale = 1;
  const maxScale = 4;

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    setIsZoomed(false);
    Animated.parallel([
      Animated.spring(imageScale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 0,
      }),
      Animated.spring(imageTranslateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }),
      Animated.spring(imageTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }),
    ]).start();
  }, [imageScale, imageTranslateX, imageTranslateY]);

  const clampTranslate = (value: number, axis: 'x' | 'y', scale: number) => {
    if (scale <= minScale) {
      return 0;
    }

    const frameWidth = screenWidth * 0.9;
    const frameHeight = screenHeight * 0.85;
    const limit =
      axis === 'x'
        ? ((frameWidth * scale) - frameWidth) / 2
        : ((frameHeight * scale) - frameHeight) / 2;

    if (limit <= 0) {
      return 0;
    }

    return Math.max(-limit, Math.min(limit, value));
  };

  const getTouchDistance = (touches: readonly { pageX: number; pageY: number }[]) => {
    if (touches.length < 2) {
      return 0;
    }

    const [first, second] = touches;
    const dx = second.pageX - first.pageX;
    const dy = second.pageY - first.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const finishGesture = () => {
    activeGesture.current = 'none';

    if (scaleRef.current <= 1.01) {
      resetZoom();
      return;
    }

    const clampedX = clampTranslate(translateRef.current.x, 'x', scaleRef.current);
    const clampedY = clampTranslate(translateRef.current.y, 'y', scaleRef.current);
    translateRef.current = { x: clampedX, y: clampedY };
    setIsZoomed(true);
    Animated.parallel([
      Animated.spring(imageTranslateX, {
        toValue: clampedX,
        useNativeDriver: true,
        bounciness: 0,
      }),
      Animated.spring(imageTranslateY, {
        toValue: clampedY,
        useNativeDriver: true,
        bounciness: 0,
      }),
    ]).start();
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;

    if (touches.length >= 2) {
      activeGesture.current = 'pinch';
      gestureStartScale.current = scaleRef.current;
      gestureStartTranslate.current = { ...translateRef.current };
      pinchStartDistance.current = getTouchDistance(touches);
      return;
    }

    if (touches.length === 1 && scaleRef.current > 1.01) {
      activeGesture.current = 'pan';
      gestureStartTranslate.current = { ...translateRef.current };
      panStartPoint.current = {
        x: touches[0].pageX,
        y: touches[0].pageY,
      };
    }
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;

    if (touches.length >= 2) {
      if (activeGesture.current !== 'pinch') {
        activeGesture.current = 'pinch';
        gestureStartScale.current = scaleRef.current;
        gestureStartTranslate.current = { ...translateRef.current };
        pinchStartDistance.current = getTouchDistance(touches);
      }

      const distance = getTouchDistance(touches);
      if (pinchStartDistance.current <= 0 || distance <= 0) {
        return;
      }

      const nextScale = Math.max(
        minScale,
        Math.min(maxScale, gestureStartScale.current * (distance / pinchStartDistance.current))
      );

      scaleRef.current = nextScale;
      setIsZoomed(nextScale > 1.01);
      imageScale.setValue(nextScale);

      const clampedX = clampTranslate(translateRef.current.x, 'x', nextScale);
      const clampedY = clampTranslate(translateRef.current.y, 'y', nextScale);
      translateRef.current = { x: clampedX, y: clampedY };
      imageTranslateX.setValue(clampedX);
      imageTranslateY.setValue(clampedY);
      return;
    }

    if (touches.length === 1 && scaleRef.current > 1.01) {
      if (activeGesture.current !== 'pan') {
        activeGesture.current = 'pan';
        gestureStartTranslate.current = { ...translateRef.current };
        panStartPoint.current = {
          x: touches[0].pageX,
          y: touches[0].pageY,
        };
      }

      const nextX = clampTranslate(
        gestureStartTranslate.current.x + (touches[0].pageX - panStartPoint.current.x),
        'x',
        scaleRef.current
      );
      const nextY = clampTranslate(
        gestureStartTranslate.current.y + (touches[0].pageY - panStartPoint.current.y),
        'y',
        scaleRef.current
      );

      translateRef.current = { x: nextX, y: nextY };
      imageTranslateX.setValue(nextX);
      imageTranslateY.setValue(nextY);
    }
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;

    if (touches.length >= 2) {
      gestureStartScale.current = scaleRef.current;
      gestureStartTranslate.current = { ...translateRef.current };
      pinchStartDistance.current = getTouchDistance(touches);
      activeGesture.current = 'pinch';
      return;
    }

    if (touches.length === 1 && scaleRef.current > 1.01) {
      activeGesture.current = 'pan';
      gestureStartTranslate.current = { ...translateRef.current };
      panStartPoint.current = {
        x: touches[0].pageX,
        y: touches[0].pageY,
      };
      return;
    }

    finishGesture();
  };

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      resetZoom();
    }
  }, [visible, initialIndex, resetZoom]);

  useEffect(() => {
    resetZoom();
  }, [currentIndex, resetZoom]);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <View ref={overlayRef as any} style={styles.overlay} {...(webProps as any)}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close image viewer"
      />

      <Pressable
        style={({ pressed }) => [
          styles.closeButton,
          { top: Math.max(insets.top + 8, 20) },
          pressed && styles.closeButtonPressed,
        ]}
        onPress={onClose}
        accessibilityLabel="Close"
        accessibilityRole="button"
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

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
          <Animated.View
            onStartShouldSetResponder={() => Platform.OS !== 'web'}
            onMoveShouldSetResponder={() => Platform.OS !== 'web'}
            onResponderTerminationRequest={() => false}
            onResponderGrant={handleTouchStart}
            onResponderMove={handleTouchMove}
            onResponderRelease={handleTouchEnd}
            onResponderTerminate={finishGesture}
            style={styles.zoomSurface}
          >
            <Animated.Image
              source={{ uri: imageUri }}
              style={[
                styles.image,
                {
                  transform: [
                    { scale: imageScale },
                    { translateX: imageTranslateX },
                    { translateY: imageTranslateY },
                  ],
                },
              ]}
              resizeMode="contain"
              accessibilityLabel={`Image ${currentIndex + 1} of ${images.length}`}
            />
          </Animated.View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Image unavailable</Text>
          </View>
        )}
      </View>

      {hasMultiple && !isZoomed && (
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

      {Platform.OS !== 'web' && (
        <View style={[styles.zoomHint, { top: Math.max(insets.top + 64, 76) }]}>
          <Text style={styles.zoomHintText}>
            {isZoomed ? 'Drag to inspect details' : 'Pinch to zoom'}
          </Text>
        </View>
      )}

      {hasMultiple && !isZoomed && (
        <View style={[styles.indicators, { bottom: Math.max(insets.bottom + 16, 24) }]}>
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
  zoomSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    zIndex: 10,
    alignItems: 'center',
    gap: spacing.sm,
  },
  zoomHint: {
    position: 'absolute',
    zIndex: 10,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  zoomHintText: {
    ...typography.footnote,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
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
