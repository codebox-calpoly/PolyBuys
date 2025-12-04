import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from '../../backend/convex/_generated/api';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const listings = useQuery(api.listings.getListings);
  const router = useRouter();

  if (listings === undefined) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to PolyBuy</Text>
      <Text style={styles.subtitle}>Marketplace for Cal Poly Students</Text>

      <FlatList
        data={listings}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listingCard}
            onPress={() => router.push(`/listings/${item._id}`)}
          >
            <Text style={styles.listingTitle}>{item.title}</Text>
            <Text style={styles.listingPrice}>${item.price}</Text>
            <Text style={styles.listingDescription}>{item.description}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  listingCard: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  listingDescription: {
    fontSize: 14,
    color: '#666',
  },
});
