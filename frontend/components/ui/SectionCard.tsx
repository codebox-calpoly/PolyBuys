import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../../theme/tokens';

interface SectionCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  /** Remove default padding (useful for list containers). */
  noPadding?: boolean;
}

export function SectionCard({
  children,
  title,
  subtitle,
  style,
  noPadding = false,
}: SectionCardProps) {
  return (
    <View style={[styles.card, noPadding && styles.cardNoPadding, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardNoPadding: {
    padding: 0,
  },
  header: {
    gap: 2,
  },
  title: {
    ...typography.heading,
    color: colors.textDark,
  },
  subtitle: {
    ...typography.footnoteMed,
    color: colors.text,
  },
});

export default SectionCard;
