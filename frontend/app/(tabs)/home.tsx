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
import { SortPicker } from '../../components/SortPicker';
import ListingCard from '../../components/ListingCard';
import { ScreenState } from '../../components/ScreenState';
import { ScreenHeader } from '../../components/ui';
import type { Filters, Category, ListingSortBy } from '../../types/filters';
import { useAuth } from '../../hooks/useAuth';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { borderRadius, colors, spacing, typography } from '../../theme/tokens';

const PAGE_SIZE = 20;
const FOCUS_REFETCH_STALE_MS = 45_000;

function buildWebRows(items: Doc<'listings'>[], size: number) {
  const rows: Array<{
    key: string;
    startIndex: number;
    items: Doc<'listings'>[];
    fillerKeys: string[];
  }> = [];

  for (let startIndex = 0; startIndex < items.length; startIndex += size) {
    const rowItems = items.slice(startIndex, startIndex + size);
    const rowKey = rowItems.map((item) => item._id).join('-');
    const fillerKeys: string[] = [];

    for (let slot = rowItems.length; slot < size; slot += 1) {
      fillerKeys.push(`${rowKey}-filler-${slot}`);
    }

    rows.push({ key: rowKey, startIndex, items: rowItems, fillerKeys });
  }

  return rows;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isSessionLoading } = useAuth();
  const { q } = useLocalSearchParams<{ q?: string | string[] }>();
  const { width } = useWindowDimensions();
  const entranceStyle = useEntranceAnimation();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= 1024;
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

  const [filters, setFilters] = useState<Filters>({});
  const [sortBy, setSortBy] = useState<ListingSortBy>('newest');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPricePicker, setShowPricePicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);

  const [allListings, setAllListings] = useState<Doc<'listings'>[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const filterVersionRef = useRef(0);
  const currentFilterVersionRef = useRef(0);

  const processedCursorsRef = useRef(new Set<string>());
  const lastFirstPageAtRef = useRef<number>(0);
  const hasLoadedOnceRef = useRef(false);

  const searchQuery = Array.isArray(q) ? (q[0] ?? '').trim() : (q ?? '').trim();
  const hasSearchQuery = isWeb && searchQuery.length > 0;
  const activeFilterKey = `${filters.category ?? ''}|${filters.minPrice ?? ''}|${filters.maxPrice ?? ''}|${searchQuery}|${sortBy}`;

  const queryFilterVersion = currentFilterVersionRef.current;

  const toggleSavedListing = useMutation(api.savedListings.toggleSavedListing);
  const listingsResultStandard = useQuery(
    api.listings.searchAndFilterListings,
    !hasSearchQuery
      ? {
          filters: {
            sortBy,
            category: filters.category,
            minPrice: filters.minPrice,
            maxPrice: filters.maxPrice,
          },
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
            sortBy,
          },
          paginationOpts: { numItems: PAGE_SIZE, cursor },
          _refreshKey: refreshKey,
        }
      : 'skip'
  );
  const listingsResult = hasSearchQuery ? listingsResultSearch : listingsResultStandard;

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

  useEffect(() => {
    if (!refreshing || cursor !== null) return;
    const fallback = setTimeout(() => setRefreshing(false), 15000);
    return () => clearTimeout(fallback);
  }, [refreshing, cursor]);

  useEffect(() => {
    if (listingsResult !== undefined || cursor !== null) {
      setLoadError(false);
      return;
    }
    const timer = setTimeout(() => setLoadError(true), 12000);
    return () => clearTimeout(timer);
  }, [listingsResult, cursor]);

  useEffect(() => {
    void activeFilterKey;
    filterVersionRef.current += 1;
    currentFilterVersionRef.current = filterVersionRef.current;
    setCursor(null);
    setAllListings([]);
    setIsDone(false);
    processedCursorsRef.current.clear();
    hasLoadedOnceRef.current = false;
  }, [activeFilterKey]);

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
    isAuthenticated && !isWeb && listings.length > 0
      ? { listingIds: listings.map((l) => l._id) }
      : 'skip'
  );

  const handleToggleSave = useCallback(
    async (listingId: Id<'listings'>) => {
      if (isWeb) {
        router.push('/auth/login?returnTo=%2F' as never);
        return;
      }

      if (!isAuthenticated) {
        router.replace('/auth/login?returnTo=%2Fhome' as never);
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
    [isAuthenticated, isWeb, router, toggleSavedListing]
  );

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
    setSortBy('newest');
    router.setParams({ q: undefined });
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
    if (isWeb) {
      router.push({
        pathname: '/auth/login',
        params: { returnTo: '/listings/new' },
      } as never);
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to create a listing', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.replace('/auth/login') },
      ]);
      return;
    }
    router.push('/listings/new');
  };

  const isCompactLayout = width < 760;
  const contentPadding = isWeb
    ? isDesktopWeb
      ? spacing.xl
      : width >= 900
        ? spacing.lg
        : 10
    : width >= 900
      ? spacing.xxl
      : isCompactLayout
        ? spacing.xs
        : spacing.sm;
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
                      ? 'Try a wider price range or different category.'
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
  const webRows = buildWebRows(listings, homeColumns);

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

        <SortPicker
          visible={showSortPicker}
          sortBy={sortBy}
          onSelect={setSortBy}
          onClose={() => setShowSortPicker(false)}
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
              disabled={isSessionLoading}
              accessibilityLabel={
                isWeb ? 'Download the Mobile App to Create Listings' : 'Create listing'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.createChipText, isWeb && styles.webCreateChipText]}>
                {isWeb
                  ? 'Download the Mobile App to Create Listings'
                  : isAuthenticated
                    ? '+ Create listing'
                    : 'Sign in to sell'}
              </Text>
            </Pressable>
          </Animated.View>

          <FilterBar
            filters={filters}
            sortBy={sortBy}
            onCategoryPress={() => setShowCategoryPicker(true)}
            onPricePress={() => setShowPricePicker(true)}
            onSortPress={() => setShowSortPicker(true)}
            onClearCategory={handleClearCategory}
            onClearPrice={handleClearPrice}
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
                {webRows.map((row) => (
                  <View key={row.key} style={styles.columnWrapper}>
                    {row.items.map((item, columnOffset) => (
                      <View key={item._id} style={styles.webGridItem}>
                        <ListingCard
                          listing={item}
                          index={row.startIndex + columnOffset}
                          isSaved={savedState?.[item._id] ?? false}
                          density="home"
                          shellStyle="flat"
                        />
                      </View>
                    ))}
                    {row.fillerKeys.map((fillerKey) => (
                      <View key={fillerKey} style={styles.webGridItem} />
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
    <View style={[styles.page, styles.pageMobile]}>
      <View
        style={[styles.content, { paddingHorizontal: contentPadding, maxWidth: contentMaxWidth }]}
      >
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        <Animated.View style={[styles.homeTopBlock, entranceStyle]}>
          <ScreenHeader
            title="Browse"
            subtitle="Fresh listings from campus"
            action={
              <Pressable
                style={({ pressed }) => [styles.createChip, pressed && styles.createChipPressed]}
                onPress={handleCreateListing}
                disabled={isSessionLoading}
                accessibilityLabel="Create listing"
                accessibilityRole="button"
              >
                <Text style={styles.createChipText}>+ Create</Text>
              </Pressable>
            }
          />
          <FilterBar
            filters={filters}
            sortBy={sortBy}
            onCategoryPress={() => setShowCategoryPicker(true)}
            onPricePress={() => setShowPricePicker(true)}
            onSortPress={() => setShowSortPicker(true)}
            onClearCategory={handleClearCategory}
            onClearPrice={handleClearPrice}
            onClearAll={handleClearAll}
          />
        </Animated.View>

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

        <SortPicker
          visible={showSortPicker}
          sortBy={sortBy}
          onSelect={setSortBy}
          onClose={() => setShowSortPicker(false)}
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
                shellStyle="flat"
              />
            )}
            numColumns={homeColumns}
            columnWrapperStyle={
              homeColumns > 1
                ? [styles.columnWrapper, isCompactLayout && styles.columnWrapperCompact]
                : undefined
            }
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
  pageMobile: {
    backgroundColor: colors.surface,
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
    gap: spacing.md,
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
  webCreateChip: {
    minWidth: 280,
    alignItems: 'center',
  },
  webCreateChipText: {
    textAlign: 'center',
  },
  homeTopBlock: {
    gap: spacing.md,
  },
  createChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createChipPressed: {
    opacity: 0.9,
  },
  createChipText: {
    ...typography.subhead,
    color: colors.white,
    fontWeight: '600',
  },
  columnWrapper: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  columnWrapperCompact: {
    gap: spacing.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  stateContainer: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  stateCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  listContainer: {
    paddingTop: spacing.xs,
    paddingBottom: 26,
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
