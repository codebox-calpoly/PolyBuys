import { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { colors, spacing } from '../../theme/tokens';
import { KeyboardUnderlay } from './KeyboardUnderlay';

type KeyboardDockScreenProps = {
  children: ReactNode;
  dock: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  dockStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  compactBottomPadding?: number;
  expandedBottomPadding?: number;
  keyboardUnderlayColor?: string;
};

export function KeyboardDockScreen({
  children,
  dock,
  style,
  contentStyle,
  dockStyle,
  keyboardVerticalOffset = 0,
  compactBottomPadding = spacing.xs,
  expandedBottomPadding = spacing.sm,
  keyboardUnderlayColor = colors.surface,
}: KeyboardDockScreenProps) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const bottomPadding =
    keyboardHeight > 0 ? compactBottomPadding : Math.max(insets.bottom, expandedBottomPadding);

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardVerticalOffset : 0}
    >
      <KeyboardUnderlay keyboardHeight={keyboardHeight} backgroundColor={keyboardUnderlayColor} />
      <View style={[styles.content, contentStyle]}>{children}</View>
      <View style={[styles.dock, { paddingBottom: bottomPadding }, dockStyle]}>{dock}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
  },
  dock: {
    backgroundColor: colors.surface,
  },
});

export default KeyboardDockScreen;
