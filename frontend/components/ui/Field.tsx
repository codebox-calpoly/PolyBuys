import { View, TextInput, StyleSheet, type TextInputProps, type ViewProps } from 'react-native';
import { AppText } from './AppText';
import { colors, borderRadius, spacing, typography } from '../../theme/tokens';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  containerStyle?: ViewProps['style'];
  inputStyle?: TextInputProps['style'];
  error?: string;
}

export function Field({
  label,
  containerStyle,
  inputStyle,
  error,
  placeholderTextColor = colors.text,
  ...props
}: FieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="footnoteMed" color="textDark" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        style={[styles.input, error && styles.inputError, inputStyle]}
        placeholderTextColor={placeholderTextColor}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        {...props}
      />
      {error ? (
        <AppText variant="footnote" color="category" style={styles.errorText}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    marginBottom: 2,
  },
  input: {
    ...typography.body,
    color: colors.textDark,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.category,
  },
  errorText: {
    marginTop: 2,
  },
});
