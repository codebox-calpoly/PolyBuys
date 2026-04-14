import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FlashContextValue = {
  setFlash: (message: string) => void;
};

const FlashContext = createContext<FlashContextValue | null>(null);

const FLASH_DURATION_MS = 2000;

export function useFlash() {
  const ctx = useContext(FlashContext);
  if (!ctx) {
    throw new Error('useFlash must be used within FlashProvider');
  }
  return ctx;
}

const BANNER_TOP_OFFSET = 16;

export function FlashProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTop = insets.top + BANNER_TOP_OFFSET;

  const clearFlash = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessage(null);
  }, []);

  const setFlash = useCallback((msg: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessage(msg);
    timeoutRef.current = setTimeout(() => {
      setMessage(null);
      timeoutRef.current = null;
    }, FLASH_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <FlashContext.Provider value={{ setFlash }}>
      <View style={styles.wrapper} pointerEvents="box-none">
        {children}
        {message ? (
          <Pressable
            style={({ pressed }) => [
              styles.banner,
              { top: bannerTop },
              pressed && styles.bannerPressed,
            ]}
            onPress={clearFlash}
            accessibilityRole="alert"
            accessibilityHint="Double tap to dismiss"
          >
            <Text style={styles.text}>{message}</Text>
            <Text style={styles.dismissHint}>Tap to dismiss</Text>
          </Pressable>
        ) : null}
      </View>
    </FlashContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
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
  dismissHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontWeight: '500',
  },
});
