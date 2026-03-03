import { Animated, ScrollView, StyleSheet, Text } from 'react-native';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';

export default function InboxScreen() {
  const entranceStyle = useEntranceAnimation();

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Animated.View style={[styles.card, entranceStyle]}>
        <Text style={styles.eyebrow}>Inbox</Text>
        <Text style={styles.title}>Messaging is coming soon</Text>
        <Text style={styles.body}>
          The messaging UI is being built right now. This tab is ready and will connect to live
          conversations once that work lands.
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f7f5',
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 26,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 12,
    color: '#2a6f52',
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f2b21',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5a6f65',
  },
});
