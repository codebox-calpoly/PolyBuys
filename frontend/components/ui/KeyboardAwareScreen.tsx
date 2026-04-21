import { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { colors } from '../../theme/tokens';
import { KeyboardUnderlay } from './KeyboardUnderlay';
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
  keyboardUnderlayColor?: string;
}

function getNumericPadding(value: ViewStyle['padding'] | ViewStyle['paddingVertical']) {
  return typeof value === 'number' ? value : 0;
}

function getCallerPaddingBottom(style?: ViewStyle) {
  if (!style) {
    return 0;
  }

  if (style.paddingBottom !== undefined) {
    return getNumericPadding(style.paddingBottom);
  }

  if (style.paddingVertical !== undefined) {
    return getNumericPadding(style.paddingVertical);
  }

  return getNumericPadding(style.padding);
}

export function KeyboardAwareScreen({
  children,
  contentContainerStyle,
  style,
  extraOffset = 0,
  disableSafeAreaBottom = false,
  keyboardShouldPersistTaps = 'handled',
  keyboardUnderlayColor = colors.surface,
}: KeyboardAwareScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const keyboardHeight = useKeyboardHeight();
  const bottomPadding = disableSafeAreaBottom ? 0 : insets.bottom + 8;
  const flattenedContentContainerStyle = StyleSheet.flatten(contentContainerStyle);
  const callerPaddingBottom = getCallerPaddingBottom(flattenedContentContainerStyle);
  const mergedPaddingBottom = bottomPadding + callerPaddingBottom;

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight + extraOffset : 0}
    >
      <KeyboardUnderlay keyboardHeight={keyboardHeight} backgroundColor={keyboardUnderlayColor} />
      <ScreenScrollView
        contentContainerStyle={[
          styles.content,
          contentContainerStyle,
          { paddingBottom: mergedPaddingBottom },
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
