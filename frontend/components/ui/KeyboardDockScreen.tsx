import { ReactNode, useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/tokens';

type KeyboardDockScreenProps = {
  children: ReactNode;
  dock: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  dockStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  compactBottomPadding?: number;
  expandedBottomPadding?: number;
};

function useKeyboardVisibility(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return isKeyboardVisible;
}

export function KeyboardDockScreen({
  children,
  dock,
  style,
  contentStyle,
  dockStyle,
  keyboardVerticalOffset = 0,
  compactBottomPadding = spacing.xs,
  expandedBottomPadding = spacing.sm,
}: KeyboardDockScreenProps) {
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardVisibility();
  const bottomPadding = isKeyboardVisible
    ? compactBottomPadding
    : Math.max(insets.bottom, expandedBottomPadding);

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardVerticalOffset : 0}
    >
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
