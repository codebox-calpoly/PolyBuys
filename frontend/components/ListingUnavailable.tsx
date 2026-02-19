import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function ListingUnavailable() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This listing is no longer available</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}>
        <Text style={styles.buttonText}>Back to Browse</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: { fontSize: 20, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 16 },
  button: {
    backgroundColor: '#154734',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
