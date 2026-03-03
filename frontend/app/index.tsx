import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FilterBar } from '../components/FilterBar';
import { CategoryPicker } from '../components/CategoryPicker';
import { PriceRangePicker } from '../components/PriceRangePicker';
import ListingCard from '../components/ListingCard';
import type { Filters, Category } from '../types/filters';
import { useAuth } from '../hooks/useAuth';
import type { Doc } from '../../backend/convex/_generated/dataModel';

const PAGE_SIZE = 20; // Load 20 items per page

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { tags } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width > 1024;
  const isTablet = isWeb && width > 768 && width <= 1024;

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

  // Defensive client-side guard in case stale cache includes hidden listings.
  const listings = allListings.filter((listing) => listing.isHidden !== true);

  // If a fetched page is fully hidden by defensive filtering, auto-advance pagination.
  useEffect(() => {
    if (
      !isLoading &&
      !isLoadingMore &&
      !isDone &&
      allListings.length > 0 &&
      listings.length === 0 &&
      listingsResult?.continueCursor
    ) {
      setIsLoadingMore(true);
      setCursor(listingsResult.continueCursor);
    }
  }, [
    isLoading,
    isLoadingMore,
    isDone,
    allListings.length,
    listings.length,
    listingsResult?.continueCursor,
  ]);

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
    router.push('/listings/new');
  };

  // Calculate columns for responsive grid
  const numColumns = useMemo(() => {
    if (!isWeb) return 1;
    if (isDesktop) return 3;
    if (isTablet) return 2;
    return 1;
  }, [isWeb, isDesktop, isTablet]);

  // Set document title for web SEO
  useEffect(() => {
    if (isWeb && typeof document !== 'undefined') {
      document.title = 'PolyBuys — Cal Poly Student Marketplace';
    }
  }, [isWeb]);

  return (
    <View style={[styles.container, isWeb && styles.webContainer]}>
      <View style={[styles.header, isWeb && styles.webHeader]}>
        <View>
          <Text style={styles.title}>Welcome to PolyBuys</Text>
          <Text style={styles.subtitle}>Marketplace for Cal Poly Students</Text>
        </View>
        {isLoading ? null : isAuthenticated ? (
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/settings')}>
              <Text style={styles.profileButtonText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateListing}>
              <Text style={styles.createButtonText}>+ Create</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/auth/login')}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        )}
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
          key={`list-${numColumns}`}
          data={listings}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          contentContainerStyle={[
            styles.listContainer,
            isWeb && numColumns > 1 && styles.webListContainer,
          ]}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
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
  webContainer: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  webHeader: {
    paddingHorizontal: 0,
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  profileButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
  webListContainer: {
    paddingHorizontal: 0,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  signInButton: {
    backgroundColor: '#154734',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  signInButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
