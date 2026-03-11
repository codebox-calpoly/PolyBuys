import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';
import { colors, typography, borderRadius } from '../theme/tokens';

export default function ListingUnavailable() {
  const router = useRouter();
  const entranceStyle = useEntranceAnimation();

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, entranceStyle]}>
        <Text style={styles.title}>This listing is no longer available</Text>
        <Text style={styles.subtitle}>
          It may have been removed, sold, or hidden by moderation.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => router.replace('/')}
          accessibilityLabel="Back to browse"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Back to browse</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.placeholderBg,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.placeholderBorder,
    backgroundColor: colors.white,
    padding: 20,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
    gap: 10,
  },
  title: {
    ...typography.title1,
    color: colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.footnote,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    ...typography.subhead,
    color: colors.white,
    fontWeight: '600',
  },
});
