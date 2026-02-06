import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import FilterBar from '../components/FilterBar';
import ListingCard from '../components/ListingCard';

export default function HomeScreen() {
  const router = useRouter();
  const { tags } = useLocalSearchParams();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Initialize selected tags from URL params
  useEffect(() => {
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      setSelectedTags(tagArray);
    } else {
      // Reset tags when navigating without tag params
      setSelectedTags([]);
    }
  }, [tags]);

  const listings = useQuery(api.listings.getListings, {
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Welcome to PolyBuy</Text>
          <Text style={styles.subtitle}>Marketplace for Cal Poly Students</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={() => router.push('/listings/new')}>
          <Text style={styles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <FilterBar selectedTags={selectedTags} onTagsChange={setSelectedTags} />

      {listings === undefined ? (
        <View style={styles.centerContainer}>
          <Text>Loading...</Text>
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            {selectedTags.length > 0
              ? 'No listings found with selected tags.'
              : 'No listings yet. Start by adding one!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={styles.listContainer}
        />
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
});
