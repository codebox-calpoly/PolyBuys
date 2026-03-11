import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterBar } from '../../components/FilterBar';
import { CategoryPicker } from '../../components/CategoryPicker';
import { PriceRangePicker } from '../../components/PriceRangePicker';
import ListingCard from '../../components/ListingCard';
import { ScreenState } from '../../components/ScreenState';
import type { Filters, Category } from '../../types/filters';
import { useAuth } from '../../hooks/useAuth';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { colors } from '../../theme/tokens';

const PAGE_SIZE = 20;
/** Only refetch on focus when data is older than this (avoids redundant queries and preserves scroll/pagination) */
const FOCUS_REFETCH_STALE_MS = 45_000;

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
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState(false);

  // Filter versioning to prevent stale results
  const filterVersionRef = useRef(0);
  const currentFilterVersionRef = useRef(0);

  // Track processed cursors to avoid duplicate appends
  const processedCursorsRef = useRef(new Set<string>());
  // When we last received the first page (for focus-based staleness check)
  const lastFirstPageAtRef = useRef<number>(0);

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

  const toggleSavedListing = useMutation(api.savedListings.toggleSavedListing);
  const listingsResult = useQuery(api.listings.getListings, {
    category: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    paginationOpts: { numItems: PAGE_SIZE, cursor },
    _refreshKey: refreshKey,
  });

  // Reset pagination and refetch first page (used by pull-to-refresh and focus).
  // Bumping refreshKey forces Convex to re-run when cursor is already null.
  const refreshListings = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setCursor(null);
    processedCursorsRef.current.clear();
  }, []);

  useEffect(() => {
    if (listingsResult && queryFilterVersion === filterVersionRef.current) {
      const cursorId = cursor || 'initial';
      if (!processedCursorsRef.current.has(cursorId)) {
        if (cursor === null) {
          setAllListings(listingsResult.page);
          setRefreshing(false);
          lastFirstPageAtRef.current = Date.now();
        } else {
          setAllListings((prev) => [...prev, ...listingsResult.page]);
        }
        setIsDone(listingsResult.isDone);
        setIsLoadingMore(false);
        processedCursorsRef.current.add(cursorId);
      }
    }
  }, [listingsResult, cursor, queryFilterVersion]);

  // Stop refresh spinner if the query never returns (e.g. network failure)
  useEffect(() => {
    if (!refreshing || cursor !== null) return;
    const fallback = setTimeout(() => setRefreshing(false), 15000);
    return () => clearTimeout(fallback);
  }, [refreshing, cursor]);

  // Show error state if loading takes too long (e.g. network failure)
  useEffect(() => {
    if (listingsResult !== undefined || cursor !== null) {
      setLoadError(false);
      return;
    }
    const timer = setTimeout(() => setLoadError(true), 12000);
    return () => clearTimeout(timer);
  }, [listingsResult, cursor]);

  useEffect(() => {
    filterVersionRef.current += 1;
    currentFilterVersionRef.current = filterVersionRef.current;
    setCursor(null);
    setAllListings([]);
    setIsDone(false);
    processedCursorsRef.current.clear();
  }, [filters.category, filters.minPrice, filters.maxPrice, selectedTags]);

  // Refetch when returning to Home only if data is stale (avoids redundant queries, preserves scroll/pagination)
  useFocusEffect(
    useCallback(() => {
      const last = lastFirstPageAtRef.current;
      if (last > 0 && Date.now() - last > FOCUS_REFETCH_STALE_MS) {
        refreshListings();
      }
    }, [refreshListings])
  );

  const listings = allListings.filter((listing) => listing.isHidden !== true);

  const savedState = useQuery(
    api.savedListings.getSavedStateForListings,
    isAuthenticated && listings.length > 0 ? { listingIds: listings.map((l) => l._id) } : 'skip'
  );

  const handleToggleSave = useCallback(
    async (listingId: Id<'listings'>) => {
      if (!isAuthenticated) {
        router.push('/auth/login?returnTo=%2F' as never);
        return;
      }

      try {
        await toggleSavedListing({ listingId });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to save listing right now.';
        Alert.alert('Save failed', message);
      }
    },
    [isAuthenticated, router, toggleSavedListing]
  );

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

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshListings();
  }, [refreshListings]);

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

  return (
    <View style={styles.page}>
      <View style={[styles.content, { paddingHorizontal: contentPadding }]}>
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        <Animated.View style={[styles.searchRow, entranceStyle]}>
          <Pressable
            style={styles.searchBarWrap}
            onPress={() => router.push('/search')}
            accessibilityLabel="Search items"
            accessibilityRole="button"
          >
            <Text style={styles.searchPlaceholder}>Search items...</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.createChip, pressed && styles.createChipPressed]}
            onPress={handleCreateListing}
            disabled={isLoading}
            accessibilityLabel="Create listing"
            accessibilityRole="button"
          >
            <Text style={styles.createChipText}>+ Create</Text>
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
            <ScreenState
              variant={loadError ? 'error' : 'loading'}
              title={loadError ? "Couldn't load listings" : 'Loading listings...'}
              message={loadError ? 'Check your connection and try again.' : undefined}
              onRetry={loadError ? refreshListings : undefined}
            />
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.centerContainer}>
            <ScreenState
              variant="empty"
              title={hasActiveFilters ? 'No listings match your filters' : 'No listings yet'}
              message={
                hasActiveFilters
                  ? 'Try a wider price range or fewer tags.'
                  : 'Be the first to post something for campus.'
              }
              actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
              onAction={hasActiveFilters ? handleClearAll : undefined}
            />
          </View>
        ) : (
          <FlatList
            data={listings}
            keyExtractor={(item) => item._id}
            renderItem={({ item, index }) => (
              <ListingCard
                listing={item}
                index={index}
                isSaved={savedState?.[item._id] ?? false}
                onToggleSave={() => void handleToggleSave(item._id as Id<'listings'>)}
              />
            )}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContainer}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
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
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingTop: 16,
    gap: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBarWrap: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  searchPlaceholder: {
    fontSize: 17,
    color: colors.text,
  },
  createChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  createChipPressed: {
    opacity: 0.9,
  },
  createChipText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  columnWrapper: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
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
    color: colors.text,
  },
});
