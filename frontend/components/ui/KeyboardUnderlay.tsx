import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

type KeyboardUnderlayProps = {
  keyboardHeight: number;
  backgroundColor: string;
  style?: StyleProp<ViewStyle>;
};

export function KeyboardUnderlay({
  keyboardHeight,
  backgroundColor,
  style,
}: KeyboardUnderlayProps) {
  if (keyboardHeight <= 0) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.underlay, { height: keyboardHeight, backgroundColor }, style]}
    />
  );
}

const styles = StyleSheet.create({
  underlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default KeyboardUnderlay;
