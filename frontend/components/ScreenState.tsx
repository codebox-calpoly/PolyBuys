import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

export type ScreenStateVariant = 'loading' | 'empty' | 'error';

export interface ScreenStateProps {
  variant: ScreenStateVariant;
  title: string;
  message?: string;
  onRetry?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function ScreenState({
  variant,
  title,
  message,
  onRetry,
  actionLabel,
  onAction,
}: ScreenStateProps) {
  const isLoading = variant === 'loading';
  const isError = variant === 'error';
  const showRetry = isError && onRetry;
  const showAction = actionLabel && onAction;

  return (
    <View style={styles.container}>
      {isLoading && (
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      )}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {showRetry && (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onRetry}
          accessibilityLabel="Retry"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      )}
      {showAction && !showRetry && (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onAction}
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  spinner: {
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title1,
    color: colors.textDark,
    textAlign: 'center',
  },
  message: {
    ...typography.subhead,
    color: colors.text,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.white,
  },
  buttonPressed: {
    opacity: 0.9,
  },
});
