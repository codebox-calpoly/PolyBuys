import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { FilterBar } from '../components/FilterBar';
import { CategoryPicker } from '../components/CategoryPicker';
import { PriceRangePicker } from '../components/PriceRangePicker';
import ListingCard from '../components/ListingCard';
import type { Filters, Category } from '../types/filters';

export default function HomeScreen() {
  const router = useRouter();
  const { tags } = useLocalSearchParams();

  // Filter state
  const [filters, setFilters] = useState<Filters>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPricePicker, setShowPricePicker] = useState(false);

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

  // Pass all filters to query
  const listings = useQuery(api.listings.getListings, {
    category: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
  });

  const hasActiveFilters =
    !!filters.category ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    selectedTags.length > 0;

  const handleCategorySelect = (category: Category | undefined) => {
    setFilters((prev) => ({ ...prev, category }));
  };

  const handlePriceApply = (minPrice?: number, maxPrice?: number) => {
    setFilters((prev) => ({ ...prev, minPrice, maxPrice }));
  };

  const handleClearCategory = () => {
    setFilters((prev) => ({ ...prev, category: undefined }));
  };

  const handleClearPrice = () => {
    setFilters((prev) => ({ ...prev, minPrice: undefined, maxPrice: undefined }));
  };

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
    // Sync URL params with selected tags
    if (tags.length > 0) {
      router.setParams({ tags });
    } else {
      router.setParams({ tags: undefined });
    }
  };

  const handleClearTags = () => {
    setSelectedTags([]);
    router.setParams({ tags: undefined });
  };

  const handleClearAll = () => {
    setFilters({});
    setSelectedTags([]);
    router.setParams({ tags: undefined });
  };

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

      <FilterBar
        filters={filters}
        selectedTags={selectedTags}
        onCategoryPress={() => setShowCategoryPicker(true)}
        onPricePress={() => setShowPricePicker(true)}
        onTagsChange={handleTagsChange}
        onClearCategory={handleClearCategory}
        onClearPrice={handleClearPrice}
        onClearTags={handleClearTags}
        onClearAll={handleClearAll}
      />

      <CategoryPicker
        visible={showCategoryPicker}
        selectedCategory={filters.category}
        onSelect={handleCategorySelect}
        onClose={() => setShowCategoryPicker(false)}
      />

      <PriceRangePicker
        visible={showPricePicker}
        minPrice={filters.minPrice}
        maxPrice={filters.maxPrice}
        onApply={handlePriceApply}
        onClose={() => setShowPricePicker(false)}
      />

      {listings === undefined ? (
        <View style={styles.centerContainer}>
          <Text>Loading...</Text>
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            {hasActiveFilters
              ? 'No listings match your filters'
              : 'No listings yet. Start by adding one!'}
          </Text>
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={handleClearAll}>
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
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
    marginBottom: 12,
  },
  clearFiltersButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#154734',
    borderRadius: 8,
  },
  clearFiltersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 20,
  },
});
