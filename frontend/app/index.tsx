import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FilterBar } from '../components/FilterBar';
import { CategoryPicker } from '../components/CategoryPicker';
import { PriceRangePicker } from '../components/PriceRangePicker';
import ListingCard from '../components/ListingCard';
import type { Filters, Category } from '../types/filters';
import { useAuth } from '../hooks/useAuth';
import type { Doc } from 'convex/_generated/dataModel';

const PAGE_SIZE = 20; // Load 20 items per page

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { tags } = useLocalSearchParams();

  // Filter state
  const [filters, setFilters] = useState<Filters>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPricePicker, setShowPricePicker] = useState(false);

  // Pagination state
  const [allListings, setAllListings] = useState<Doc<'listings'>[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter versioning to prevent stale results
  const filterVersionRef = useRef(0);
  const currentFilterVersionRef = useRef(0);

  // Track processed cursors to avoid duplicate appends
  const processedCursorsRef = useRef(new Set<string>());

  // Initialize selected tags from URL params
  useEffect(() => {
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      setSelectedTags((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(tagArray)) {
          return prev;
        }
        return tagArray;
      });
    } else {
      // Reset tags when navigating without tag params
      setSelectedTags((prev) => (prev.length === 0 ? prev : []));
    }
  }, [tags]);

  // Capture current filter version for this query
  const queryFilterVersion = currentFilterVersionRef.current;

  // Query for listings with current cursor
  const listingsResult = useQuery(api.listings.getListings, {
    category: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    paginationOpts: { numItems: PAGE_SIZE, cursor },
  });

  // Update listings when query results change
  useEffect(() => {
    if (listingsResult && queryFilterVersion === filterVersionRef.current) {
      // Create a cursor identifier - use 'initial' for first page
      const cursorId = cursor || 'initial';

      // Only process if we haven't already processed this cursor
      if (!processedCursorsRef.current.has(cursorId)) {
        if (cursor === null) {
          // First page - replace all listings
          setAllListings(listingsResult.page);
        } else {
          // Subsequent pages - append to existing listings
          setAllListings((prev) => [...prev, ...listingsResult.page]);
        }
        setIsDone(listingsResult.isDone);
        setIsLoadingMore(false);

        // Mark this cursor as processed
        processedCursorsRef.current.add(cursorId);
      }
    }
  }, [listingsResult, cursor, queryFilterVersion]);

  // Reset pagination when filters change
  useEffect(() => {
    // Increment filter version to invalidate in-flight queries
    filterVersionRef.current += 1;
    currentFilterVersionRef.current = filterVersionRef.current;

    // Reset pagination state
    setCursor(null);
    setAllListings([]);
    setIsDone(false);

    // Clear processed cursors for new filter
    processedCursorsRef.current.clear();
  }, [filters.category, filters.minPrice, filters.maxPrice, selectedTags]);

  const listings = allListings;

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

  const handleLoadMore = useCallback(() => {
    if (!isDone && !isLoadingMore && listingsResult?.continueCursor) {
      setIsLoadingMore(true);
      setCursor(listingsResult.continueCursor);
    }
  }, [isDone, isLoadingMore, listingsResult?.continueCursor]);

  const handleCreateListing = () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to create a listing', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }
    router.push('/listings/new');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Welcome to PolyBuy</Text>
          <Text style={styles.subtitle}>Marketplace for Cal Poly Students</Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateListing}
          disabled={isLoading}
        >
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

      {listingsResult === undefined && cursor === null ? (
        <View style={styles.centerContainer}>
          <Text>Loading...</Text>
        </View>
      ) : !listings || listings.length === 0 ? (
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
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#154734" />
                <Text style={styles.footerText}>Loading more...</Text>
              </View>
            ) : null
          }
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});
