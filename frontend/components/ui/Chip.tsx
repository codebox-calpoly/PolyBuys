import { View, StyleSheet, type ViewProps } from 'react-native';
import { AppText } from './AppText';
import { colors, borderRadius, spacing } from '../../theme/tokens';

export type ChipVariant = 'default' | 'category' | 'location' | 'outline';

export interface ChipProps extends ViewProps {
  variant?: ChipVariant;
  label: string;
  children?: React.ReactNode;
}

export function Chip({ variant = 'default', label, children, style, ...props }: ChipProps) {
  const textColor =
    variant === 'category' || variant === 'location' ? colors.textDark : colors.text;

  return (
    <View style={[styles.base, variantStyles[variant], style]} {...props}>
      {children}
      <AppText variant="subhead" color={textColor} style={styles.label}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 3,
  },
  label: {
    fontSize: 15,
  },
});

/* eslint-disable react-native/no-unused-styles -- variantStyles[variant] uses all entries */
const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  category: {
    backgroundColor: colors.category,
    borderWidth: 0,
  },
  location: {
    backgroundColor: colors.location,
    borderWidth: 0,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
