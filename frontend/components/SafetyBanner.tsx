import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

/**
 * Banner reminding users to meet in a safe, public place for in-person transactions.
 * Shown in conversation screens where buyers and sellers coordinate meetups.
 */
export default function SafetyBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Meet in a safe, public place</Text>
        <Pressable
          onPress={() => setIsVisible(false)}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Dismiss safety reminder"
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
  },
  closeButtonPressed: {
    opacity: 0.8,
  },
  closeButtonText: {
    ...typography.footnoteMed,
    color: colors.infoButton,
  },
});
