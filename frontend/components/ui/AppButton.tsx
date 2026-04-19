import { StyleSheet } from 'react-native';
import { AppPressable } from './AppPressable';
import { AppText } from './AppText';

interface AppButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onPress: () => void;
  children: string;
  accessibilityLabel?: string;
}

export function AppButton({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onPress,
  children,
  accessibilityLabel,
}: AppButtonProps) {
  const textColorKey = variant === 'primary' ? 'white' : 'text';

  return (
    <AppPressable
      variant={variant}
      size={size}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? children}
    >
      <AppText variant="body" color={textColorKey} style={styles.buttonText}>
        {children}
      </AppText>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  buttonText: {
    fontWeight: '600',
  },
});
