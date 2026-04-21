import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

const SAFETY_BANNER_DISMISSED_KEY = 'polybuy:safety-banner-dismissed';

/**
 * Banner reminding users to meet in a safe, public place for in-person transactions.
 * Shown in conversation screens where buyers and sellers coordinate meetups.
 */
export default function SafetyBanner() {
  const [isVisible, setIsVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadVisibility = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(SAFETY_BANNER_DISMISSED_KEY);
        if (isMounted) {
          setIsVisible(dismissed !== 'true');
        }
      } catch {
        if (isMounted) {
          setIsVisible(true);
        }
      }
    };

    void loadVisibility();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    void AsyncStorage.setItem(SAFETY_BANNER_DISMISSED_KEY, 'true').catch(() => {
      // Non-fatal: the banner is already hidden locally.
    });
  };

  if (isVisible !== true) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Meet in a safe, public place</Text>
        <Pressable
          onPress={handleDismiss}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss safety reminder"
          hitSlop={8}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        For everyone&apos;s safety, always complete in-person transactions in crowded, well-lit
        areas—never at a private residence or isolated location.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.infoBg,
    borderColor: colors.infoBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.footnoteMed,
    color: colors.infoText,
    flex: 1,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.infoText,
    opacity: 0.9,
    lineHeight: 18,
  },
  closeButton: {
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: borderRadius.full,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonPressed: {
    opacity: 0.8,
  },
  closeButtonText: {
    ...typography.footnoteMed,
    color: colors.infoButton,
  },
});
