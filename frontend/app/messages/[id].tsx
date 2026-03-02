import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function MessageThreadPlaceholderScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversation started</Text>
      <Text style={styles.subtitle}>Thread ID: {id ?? 'unknown'}</Text>
      <Text style={styles.body}>
        Messaging thread UI is being finalized. This confirms the conversation flow was created.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 14,
  },
  body: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
});
