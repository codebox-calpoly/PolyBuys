import { StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

/**
 * Banner reminding users to meet in a safe, public place for in-person transactions.
 * Shown in conversation screens where buyers and sellers coordinate meetups.
 */
export default function SafetyBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>Meet in a safe, public place</Text>
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
  title: {
    ...typography.footnoteMed,
    color: colors.infoText,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.infoText,
    opacity: 0.9,
    lineHeight: 18,
  },
});
