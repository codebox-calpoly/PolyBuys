import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEntranceAnimation } from '../hooks/useEntranceAnimation';

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
    backgroundColor: '#f3f7f5',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1d3329',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64786f',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#154734',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
