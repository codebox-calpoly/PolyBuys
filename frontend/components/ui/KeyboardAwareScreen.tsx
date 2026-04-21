import { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';
import { ScreenScrollView } from './ScreenScrollView';

interface KeyboardAwareScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Extra space added to the computed keyboardVerticalOffset. */
  extraOffset?: number;
  /** Disable the default safe-area bottom padding (useful when the screen renders its own fixed footer). */
  disableSafeAreaBottom?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
}

export function KeyboardAwareScreen({
  children,
  contentContainerStyle,
  style,
  extraOffset = 0,
  disableSafeAreaBottom = false,
  keyboardShouldPersistTaps = 'handled',
}: KeyboardAwareScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const bottomPadding = disableSafeAreaBottom ? 0 : insets.bottom + 8;

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight + extraOffset : 0}
    >
      <ScreenScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPadding },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      >
        {children}
      </ScreenScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
  },
});

export default KeyboardAwareScreen;
