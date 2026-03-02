import { Redirect, useLocalSearchParams } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function ShortListingRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  // Invalid or missing ID - redirect to home
  if (typeof id !== 'string' || id.trim().length === 0) {
    return <Redirect href="/" />;
  }

  // Show loading state briefly before redirecting
  // This helps with debugging and provides better UX
  const listingId = id.trim();

  return (
    <>
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.text}>Loading listing...</Text>
      </View>
      <Redirect href={`/listings/${encodeURIComponent(listingId)}`} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
