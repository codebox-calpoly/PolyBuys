import { ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { borderRadius, colors, spacing } from '../../theme/tokens';
import { KeyboardUnderlay } from './KeyboardUnderlay';

type ModalSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<Animated.WithAnimatedValue<ViewStyle>>;
  keyboardUnderlayColor?: string;
};

export function ModalSheet({
  visible,
  onClose,
  children,
  sheetStyle,
  keyboardUnderlayColor = colors.white,
}: ModalSheetProps) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight({ enabled: visible });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <KeyboardUnderlay keyboardHeight={keyboardHeight} backgroundColor={keyboardUnderlayColor} />
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View
            style={[
              styles.sheet,
              {
                marginTop: insets.top + spacing.sm,
                paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl),
              },
              sheetStyle,
            ]}
          >
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
});

export default ModalSheet;
