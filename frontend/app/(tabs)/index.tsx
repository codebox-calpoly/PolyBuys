import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterBar } from '../../components/FilterBar';
import { CategoryPicker } from '../../components/CategoryPicker';
import { PriceRangePicker } from '../../components/PriceRangePicker';
import ListingCard from '../../components/ListingCard';
import type { Filters, Category } from '../../types/filters';
import { useAuth } from '../../hooks/useAuth';
import type { Doc } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';

const PAGE_SIZE = 20;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuth();
  const { tags } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const entranceStyle = useEntranceAnimation();
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

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
      setSelectedTags((prev) => (prev.length === 0 ? prev : []));
    }
  }, [tags]);

  const queryFilterVersion = currentFilterVersionRef.current;

  const listingsResult = useQuery(api.listings.getListings, {
    category: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    paginationOpts: { numItems: PAGE_SIZE, cursor },
  });

  useEffect(() => {
    if (listingsResult && queryFilterVersion === filterVersionRef.current) {
      const cursorId = cursor || 'initial';
      if (!processedCursorsRef.current.has(cursorId)) {
        if (cursor === null) {
          setAllListings(listingsResult.page);
        } else {
          setAllListings((prev) => [...prev, ...listingsResult.page]);
        }
        setIsDone(listingsResult.isDone);
        setIsLoadingMore(false);
        processedCursorsRef.current.add(cursorId);
      }
    }
  }, [listingsResult, cursor, queryFilterVersion]);

  useEffect(() => {
    filterVersionRef.current += 1;
    currentFilterVersionRef.current = filterVersionRef.current;
    setCursor(null);
    setAllListings([]);
    setIsDone(false);
    processedCursorsRef.current.clear();
  }, [filters.category, filters.minPrice, filters.maxPrice, selectedTags]);

  const listings = allListings.filter((listing) => listing.isHidden !== true);

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

  const handleTagsChange = (nextTags: string[]) => {
    setSelectedTags(nextTags);
    if (nextTags.length > 0) {
      router.setParams({ tags: nextTags });
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
      if (Platform.OS === 'web') {
        router.push('/settings');
      } else {
        Alert.alert('Sign In Required', 'Please sign in to create a listing', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth/login') },
        ]);
      }
      return;
    }
    router.push('/listings/new');
  };

  const contentPadding = width >= 900 ? 24 : 14;
  const isWideLayout = width >= 980;

  return (
    <View style={styles.page}>
      <View style={[styles.content, { paddingHorizontal: contentPadding }]}>
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        <Animated.View style={[styles.heroCard, entranceStyle]}>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>Cal Poly Marketplace</Text>
            <Text style={styles.title}>Find your next campus deal</Text>
            <Text style={styles.subtitle}>
              Buy and sell with verified students in a fast, trusted marketplace.
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.createButton,
              isWideLayout && styles.createButtonWide,
              pressed && styles.createButtonPressed,
              isLoading && styles.createButtonDisabled,
            ]}
            onPress={handleCreateListing}
            disabled={isLoading}
          >
            <Text style={styles.createButtonText}>+ Create Listing</Text>
          </Pressable>
        </Animated.View>

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
            <ActivityIndicator size="small" color="#154734" />
            <Text style={styles.loadingText}>Loading listings...</Text>
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyTitle}>
              {hasActiveFilters ? 'No listings match your filters' : 'No listings yet'}
            </Text>
            <Text style={styles.emptyText}>
              {hasActiveFilters
                ? 'Try a wider price range or fewer tags.'
                : 'Be the first to post something for campus.'}
            </Text>
            {hasActiveFilters && (
              <Pressable style={styles.clearFiltersButton} onPress={handleClearAll}>
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item._id}
            renderItem={({ item, index }) => <ListingCard listing={item} index={index} />}
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
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f3f7f5',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingTop: 16,
    gap: 14,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#ffffff',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 12,
    color: '#2a6f52',
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f2b21',
  },
  subtitle: {
    fontSize: 15,
    color: '#5a6f65',
    lineHeight: 22,
  },
  createButton: {
    backgroundColor: '#154734',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  createButtonWide: {
    minWidth: 170,
  },
  createButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  createButtonDisabled: {
    opacity: 0.7,
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
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#5f6f68',
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 22,
    color: '#1a2f26',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#677972',
    textAlign: 'center',
    marginBottom: 14,
  },
  clearFiltersButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: '#154734',
    borderRadius: 12,
  },
  clearFiltersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 26,
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
