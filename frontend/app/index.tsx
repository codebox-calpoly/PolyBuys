import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useRouter } from 'expo-router';
import { FilterBar, type Filters, type Category } from '../components/FilterBar';
import { CategoryPicker } from '../components/CategoryPicker';
import { PriceRangePicker } from '../components/PriceRangePicker';

export default function HomeScreen() {
  const router = useRouter();

  // Filter state
  const [filters, setFilters] = useState<Filters>({});
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPricePicker, setShowPricePicker] = useState(false);

  // Pass filters to query
  const listings = useQuery(api.listings.getListings, {
    category: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  });

  const hasActiveFilters =
    !!filters.category || filters.minPrice !== undefined || filters.maxPrice !== undefined;

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

  const handleClearAll = () => {
    setFilters({});
  };

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

      <FilterBar
        filters={filters}
        onCategoryPress={() => setShowCategoryPicker(true)}
        onPricePress={() => setShowPricePicker(true)}
        onClearCategory={handleClearCategory}
        onClearPrice={handleClearPrice}
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

      {listings.length === 0 ? (
        <View style={styles.emptyContainer}>
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
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
