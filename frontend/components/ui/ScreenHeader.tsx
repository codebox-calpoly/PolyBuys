import { ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { colors, spacing, typography } from '../../theme/tokens';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Disable the entrance animation (e.g. when the screen already animates its container). */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({
  title,
  subtitle,
  action,
  animate = true,
  style,
}: ScreenHeaderProps) {
  const entranceStyle = useEntranceAnimation();

  return (
    <Animated.View style={[styles.row, animate ? entranceStyle : null, style]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.actionSlot}>{action}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.title1,
    color: colors.textDark,
  },
  subtitle: {
    ...typography.footnoteMed,
    color: colors.text,
    marginTop: 2,
  },
  actionSlot: {
    flexShrink: 0,
  },
});

export default ScreenHeader;
