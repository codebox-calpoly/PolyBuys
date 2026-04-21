import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { colors, borderRadius, spacing } from '../../theme/tokens';

const MIN_TOUCH_TARGET = 44;

export interface AppPressableProps extends Omit<PressableProps, 'style'> {
  variant?: 'default' | 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: PressableProps['style'];
  children: React.ReactNode;
}

export function AppPressable({
  variant = 'default',
  size = 'md',
  disabled = false,
  style,
  children,
  ...props
}: AppPressableProps) {
  const padding = size === 'sm' ? spacing.sm : size === 'lg' ? spacing.lg : spacing.md;
  const minHeight = Math.max(MIN_TOUCH_TARGET, padding * 2 + 20);

  return (
    <Pressable
      style={(state) => [
        styles.base,
        variantStyles[variant],
        size === 'sm' && styles.sizeSm,
        size === 'lg' && styles.sizeLg,
        { minHeight, paddingHorizontal: padding },
        state.pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={disabled}
      accessibilityRole="button"
      {...props}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  pressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  sizeSm: {
    minHeight: MIN_TOUCH_TARGET,
  },
  sizeLg: {
    minHeight: 48,
  },
});

/* eslint-disable react-native/no-unused-styles -- variantStyles[variant] uses all entries */
const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 8px 18px rgba(21, 71, 52, 0.08)',
  },
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 0,
    boxShadow: '0 12px 24px rgba(21, 71, 52, 0.22)',
  },
  secondary: {
    backgroundColor: 'rgba(21, 71, 52, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.18)',
    boxShadow: '0 8px 18px rgba(21, 71, 52, 0.08)',
  },
  ghost: {
    backgroundColor: 'rgba(21, 71, 52, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.12)',
  },
});
