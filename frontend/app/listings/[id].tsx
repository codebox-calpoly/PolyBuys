import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const listing = useQuery(api.listings.getListing, {
    id: id as Id<'listings'>,
  });

  const navigateToFeedWithTag = (tag: string) => {
    router.push({
      pathname: '/',
      params: { tags: tag },
    });
  };

  if (listing === undefined) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (listing === null) {
    return (
      <View style={styles.container}>
        <Text>Listing not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{listing.title}</Text>
      <Text style={styles.price}>${listing.price}</Text>
      <Text style={styles.description}>{listing.description}</Text>

      {listing.tags && listing.tags.length > 0 && (
        <View style={styles.tagContainer}>
          {listing.tags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.tag}
              onPress={() => navigateToFeedWithTag(tag)}
            >
              <Text style={styles.tagText}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seller Information</Text>
        <Text style={styles.sectionText}>Email: {listing.sellerEmail}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push(`/listings/${listing._id}/edit`)}
        >
          <Text style={styles.editButtonText}>Edit Listing</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#333',
    marginBottom: 24,
    lineHeight: 24,
  },
  section: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#666',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
