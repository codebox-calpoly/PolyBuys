import type { ReactNode } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { nativeChrome } from '../../theme/nativeChrome';

type GlassIconButtonProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: PressableProps['style'];
  containerStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function GlassIconButton({
  children,
  style,
  containerStyle,
  pressedScale = 0.96,
  accessibilityRole = 'button',
  ...props
}: GlassIconButtonProps) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      style={(state) => [
        styles.button,
        state.pressed && styles.buttonPressed,
        state.pressed && { transform: [{ scale: pressedScale }] },
        props.disabled && styles.buttonDisabled,
        containerStyle,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <BlurView intensity={55} tint={nativeChrome.blurTint} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.glassBase} />
      <View pointerEvents="none" style={styles.glassHighlight} />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 12px 24px rgba(12, 22, 18, 0.16)',
  },
  buttonPressed: {
    opacity: 0.98,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  glassBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '54%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.22)',
  },
});

export default GlassIconButton;
