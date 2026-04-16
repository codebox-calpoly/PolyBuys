import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FlashContextValue = {
  setFlash: (message: string) => void;
};

const FlashContext = createContext<FlashContextValue | null>(null);

const FLASH_DURATION_MS = 2000;
const FLASH_DURATION_REDUCED_MS = 900;

/** Space above bottom home indicator / tab bar so the banner does not cover primary nav. */
function bottomOffsetForPlatform(): number {
  if (Platform.OS === 'web') {
    return 16;
  }
  if (Platform.OS === 'ios') {
    return 52;
  }
  return 56;
}

export function useFlash() {
  const ctx = useContext(FlashContext);
  if (!ctx) {
    throw new Error('useFlash must be used within FlashProvider');
  }
  return ctx;
}

export function FlashProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlash = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessage(null);
  }, []);

  const setFlash = useCallback(
    (msg: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setMessage(msg);
      const ms = reduceMotion ? FLASH_DURATION_REDUCED_MS : FLASH_DURATION_MS;
      timeoutRef.current = setTimeout(() => {
        setMessage(null);
        timeoutRef.current = null;
      }, ms);
    },
    [reduceMotion]
  );

  useEffect(() => {
    let subscription: { remove?: () => void } | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    if (typeof AccessibilityInfo.addEventListener === 'function') {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    }
    return () => {
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const bottom = insets.bottom + bottomOffsetForPlatform();

  const accessibilityValue: AccessibilityValue = {
    min: 0,
    max: 100,
    now: message ? 100 : 0,
    text: message ?? undefined,
  };

  return (
    <FlashContext.Provider value={{ setFlash }}>
      <View style={styles.wrapper} pointerEvents="box-none">
        {children}
        {message ? (
          <View
            style={[styles.bannerSlot, { bottom }]}
            pointerEvents="box-none"
            accessibilityElementsHidden={false}
          >
            <Pressable
              style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
              onPress={clearFlash}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityValue={accessibilityValue}
              accessibilityHint="Double tap to dismiss"
              accessibilityLabel={message}
              pointerEvents="auto"
            >
              <Text style={styles.text}>{message}</Text>
              <View style={styles.dismissRow}>
                <Text style={styles.dismissHint}>Tap anywhere to dismiss</Text>
                <Text style={styles.dismissLinkText}>Dismiss</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
      </View>
    </FlashContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  bannerSlot: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 8,
    alignItems: 'stretch',
  },
  banner: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  bannerPressed: {
    opacity: 0.92,
  },
  text: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  dismissRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  dismissHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '500',
  },
  dismissLinkText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
});
