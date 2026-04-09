import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { borderRadius, colors, spacing, typography } from '../../theme/tokens';

const PAGE_SIZE = 20;
/** Only refetch on focus when data is older than this (avoids redundant queries and preserves scroll/pagination) */
const FOCUS_REFETCH_STALE_MS = 45_000;

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuth();
  const { tags, q } = useLocalSearchParams<{ tags?: string | string[]; q?: string | string[] }>();
  const { width } = useWindowDimensions();
  const entranceStyle = useEntranceAnimation();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= 1024;
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
  // True once we've received any first page; gates fullscreen loader to initial load only
  const hasLoadedOnceRef = useRef(false);

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

  const searchQuery = Array.isArray(q) ? (q[0] ?? '').trim() : (q ?? '').trim();
  const hasSearchQuery = isWeb && searchQuery.length > 0;

  const queryFilterVersion = currentFilterVersionRef.current;

  const toggleSavedListing = useMutation(api.savedListings.toggleSavedListing);
  const listingsResultStandard = useQuery(
    api.listings.getListings,
    !hasSearchQuery
      ? {
          category: filters.category,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          paginationOpts: { numItems: PAGE_SIZE, cursor },
          _refreshKey: refreshKey,
        }
      : 'skip'
  );
  const listingsResultSearch = useQuery(
    api.listings.searchAndFilterListings,
    hasSearchQuery
      ? {
          filters: {
            searchTerm: searchQuery,
            category: filters.category,
            minPrice: filters.minPrice,
            maxPrice: filters.maxPrice,
            tags: selectedTags.length > 0 ? selectedTags : undefined,
            sortBy: 'newest',
          },
          paginationOpts: { numItems: PAGE_SIZE, cursor },
          _refreshKey: refreshKey,
        }
      : 'skip'
  );
  const listingsResult = hasSearchQuery ? listingsResultSearch : listingsResultStandard;

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
          hasLoadedOnceRef.current = true;
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
    hasLoadedOnceRef.current = false;
  }, [filters.category, filters.minPrice, filters.maxPrice, selectedTags, searchQuery]);

  // Refetch when returning to Home only if data is stale (avoids redundant queries, preserves scroll/pagination)
  useFocusEffect(
    useCallback(() => {
      if (hasSearchQuery) {
        return;
      }
      const last = lastFirstPageAtRef.current;
      if (last > 0 && Date.now() - last > FOCUS_REFETCH_STALE_MS) {
        refreshListings();
      }
    }, [hasSearchQuery, refreshListings])
  );

  const listings = allListings.filter((listing) => listing.isHidden !== true);

  const savedState = useQuery(
    api.savedListings.getSavedStateForListings,
    isAuthenticated && listings.length > 0 ? { listingIds: listings.map((l) => l._id) } : 'skip'
  );

  const handleToggleSave = useCallback(
    async (listingId: Id<'listings'>) => {
      if (!isAuthenticated) {
        router.replace('/auth/login?returnTo=%2F' as never);
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
    router.setParams({ tags: undefined, q: undefined });
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
        router.replace('/settings');
      } else {
        Alert.alert('Sign In Required', 'Please sign in to create a listing', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.replace('/auth/login') },
        ]);
      }
      return;
    }
    router.push('/listings/new');
  };

  const contentPadding = isDesktopWeb ? spacing.xl : width >= 900 ? spacing.lg : 10;
  const contentMaxWidth = isWeb ? 1240 : 1120;
  const homeColumns = isWeb ? (width >= 1280 ? 3 : width >= 900 ? 2 : 1) : 2;
  const listEmptyComponent =
    listings.length === 0 ? (
      <View style={styles.stateContainer}>
        <View style={styles.stateCard}>
          <ScreenState
            variant={
              loadError
                ? 'error'
                : !hasLoadedOnceRef.current && cursor === null
                  ? 'loading'
                  : 'empty'
            }
            title={
              loadError
                ? "Couldn't load listings"
                : !hasLoadedOnceRef.current && cursor === null
                  ? 'Loading listings...'
                  : hasSearchQuery
                    ? 'No listings found'
                    : hasActiveFilters
                      ? 'No listings match your filters'
                      : 'No listings yet'
            }
            message={
              loadError
                ? 'Check your connection and try again.'
                : !hasLoadedOnceRef.current && cursor === null
                  ? undefined
                  : hasSearchQuery
                    ? `Nothing matched "${searchQuery}". Try a different search or fewer filters.`
                    : hasActiveFilters
                      ? 'Try a wider price range or fewer tags.'
                      : 'Be the first to post something for campus.'
            }
            actionLabel={
              loadError
                ? undefined
                : hasActiveFilters || hasSearchQuery
                  ? 'Clear Filters'
                  : undefined
            }
            onRetry={loadError ? refreshListings : undefined}
            onAction={hasActiveFilters || hasSearchQuery ? handleClearAll : undefined}
          />
        </View>
      </View>
    ) : null;
  const listFooterComponent = isLoadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.footerText}>Loading more...</Text>
    </View>
  ) : null;
  const webRows = chunkItems(listings, homeColumns);

  if (isWeb) {
    return (
      <View style={[styles.page, styles.pageWeb]}>
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

        <ScrollView
          style={[styles.webScrollView, { maxWidth: contentMaxWidth }]}
          contentContainerStyle={[
            styles.webScrollContent,
            {
              paddingHorizontal: contentPadding,
              paddingBottom: Math.max(insets.bottom + 60, 80),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}

          <Animated.View style={[styles.webToolbarRow, entranceStyle]}>
            <View style={styles.webToolbarCopy}>
              <Text style={styles.webToolbarTitle}>
                {hasSearchQuery ? `Results for "${searchQuery}"` : 'Latest listings'}
              </Text>
              <Text style={styles.webToolbarBody}>
                {hasSearchQuery
                  ? 'Use filters to narrow the results further.'
                  : 'Fresh campus listings from the PolyBuys marketplace.'}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.createChip,
                styles.webCreateChip,
                pressed && styles.createChipPressed,
              ]}
              onPress={handleCreateListing}
              disabled={isLoading}
              accessibilityLabel="Create listing"
              accessibilityRole="button"
            >
              <Text style={styles.createChipText}>
                {isAuthenticated ? '+ Create listing' : 'Sign in to sell'}
              </Text>
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

          {!hasLoadedOnceRef.current && listingsResult === undefined && cursor === null ? (
            <View style={styles.centerContainer}>
              <View style={styles.stateCard}>
                <ScreenState
                  variant={loadError ? 'error' : 'loading'}
                  title={loadError ? "Couldn't load listings" : 'Loading listings...'}
                  message={loadError ? 'Check your connection and try again.' : undefined}
                  onRetry={loadError ? refreshListings : undefined}
                />
              </View>
            </View>
          ) : listings.length === 0 ? (
            listEmptyComponent
          ) : (
            <>
              <View style={styles.webGrid}>
                {webRows.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.columnWrapper}>
                    {row.map((item, columnIndex) => (
                      <View key={item._id} style={styles.webGridItem}>
                        <ListingCard
                          listing={item}
                          index={rowIndex * homeColumns + columnIndex}
                          isSaved={savedState?.[item._id] ?? false}
                          onToggleSave={() => void handleToggleSave(item._id as Id<'listings'>)}
                          density="home"
                        />
                      </View>
                    ))}
                    {Array.from({ length: homeColumns - row.length }).map((_, fillerIndex) => (
                      <View key={`filler-${rowIndex}-${fillerIndex}`} style={styles.webGridItem} />
                    ))}
                  </View>
                ))}
              </View>
              {listFooterComponent}
              {!isDone && !isLoadingMore ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.webLoadMoreButton,
                    pressed && styles.createChipPressed,
                  ]}
                  onPress={handleLoadMore}
                  accessibilityLabel="Load more listings"
                  accessibilityRole="button"
                >
                  <Text style={styles.webLoadMoreButtonText}>Load more listings</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View
        style={[styles.content, { paddingHorizontal: contentPadding, maxWidth: contentMaxWidth }]}
      >
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        {isDesktopWeb ? (
          <Animated.View style={[styles.webHeroCard, entranceStyle]}>
            <View style={styles.webHeroTopRow}>
              <View style={styles.webHeroCopy}>
                <Text style={styles.webHeroEyebrow}>Campus marketplace</Text>
                <Text style={styles.webHeroTitle}>Browse what Cal Poly students are selling</Text>
                <Text style={styles.webHeroBody}>
                  Discover furniture, electronics, textbooks, and more in a feed designed for campus
                  pickup.
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.createChip,
                  styles.webCreateChip,
                  pressed && styles.createChipPressed,
                ]}
                onPress={handleCreateListing}
                disabled={isLoading}
                accessibilityLabel="Create listing"
                accessibilityRole="button"
              >
                <Text style={styles.createChipText}>
                  {isAuthenticated ? '+ Create listing' : 'Sign in to sell'}
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.searchBarWrap, styles.webSearchBarWrap]}
              onPress={() => router.push('/search')}
              accessibilityLabel="Search items"
              accessibilityRole="button"
            >
              <Text style={styles.searchPlaceholder}>Search items...</Text>
              <Text style={styles.webSearchHint}>
                Open the search page for focused results and recent searches.
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
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
        )}

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

        {!hasLoadedOnceRef.current && listingsResult === undefined && cursor === null ? (
          <View style={styles.centerContainer}>
            <View style={styles.stateCard}>
              <ScreenState
                variant={loadError ? 'error' : 'loading'}
                title={loadError ? "Couldn't load listings" : 'Loading listings...'}
                message={loadError ? 'Check your connection and try again.' : undefined}
                onRetry={loadError ? refreshListings : undefined}
              />
            </View>
          </View>
        ) : (
          <FlatList
            key={`home-${homeColumns}`}
            data={listings}
            keyExtractor={(item) => item._id}
            renderItem={({ item, index }) => (
              <ListingCard
                listing={item}
                index={index}
                isSaved={savedState?.[item._id] ?? false}
                onToggleSave={() => void handleToggleSave(item._id as Id<'listings'>)}
                density="home"
              />
            )}
            numColumns={homeColumns}
            columnWrapperStyle={homeColumns > 1 ? styles.columnWrapper : undefined}
            contentContainerStyle={[
              styles.listContainer,
              isDesktopWeb && styles.listContainerDesktop,
              { paddingBottom: Math.max(insets.bottom + 60, 80) },
            ]}
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
            ListEmptyComponent={listEmptyComponent}
            ListFooterComponent={listFooterComponent}
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
  pageWeb: {
    minHeight: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  webScrollView: {
    width: '100%',
    alignSelf: 'center',
  },
  webScrollContent: {
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  webToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  webToolbarCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  webToolbarTitle: {
    ...typography.title1,
    color: colors.textDark,
    fontSize: 24,
    lineHeight: 30,
  },
  webToolbarBody: {
    ...typography.subhead,
    color: colors.text,
  },
  webGrid: {
    gap: spacing.lg,
  },
  webGridItem: {
    flex: 1,
    minWidth: 0,
  },
  webLoadMoreButton: {
    alignSelf: 'center',
    minHeight: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webLoadMoreButtonText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: '600',
  },
  webHeroCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
    boxShadow: '0 18px 40px rgba(21, 71, 52, 0.08)',
  },
  webHeroTopRow: {
    gap: spacing.lg,
  },
  webHeroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  webHeroEyebrow: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  webHeroTitle: {
    ...typography.title1,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textDark,
  },
  webHeroBody: {
    ...typography.subhead,
    color: colors.text,
    maxWidth: 620,
  },
  webCreateChip: {
    minWidth: 172,
    alignItems: 'center',
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
    minHeight: 48,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  webSearchBarWrap: {
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  searchPlaceholder: {
    ...typography.body,
    color: colors.textDark,
    fontWeight: '600',
  },
  webSearchHint: {
    ...typography.footnote,
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
    gap: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  stateContainer: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  stateCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    boxShadow: '0 16px 36px rgba(21, 71, 52, 0.06)',
  },
  listContainer: {
    paddingBottom: 26,
    gap: spacing.lg,
  },
  listContainerDesktop: {
    paddingTop: spacing.xs,
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
