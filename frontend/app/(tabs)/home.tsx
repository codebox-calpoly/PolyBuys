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
import Head from 'expo-router/head';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryRail } from '../../components/CategoryRail';
import { CategoryPicker } from '../../components/CategoryPicker';
import { HomeBg } from '../../components/HomeBg';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import { PriceRangePicker } from '../../components/PriceRangePicker';
import { SortPicker } from '../../components/SortPicker';
import ListingCard from '../../components/ListingCard';
import { ScreenState } from '../../components/ScreenState';
import { ScreenHeader } from '../../components/ui';
import type { Filters, Category, ListingSortBy } from '../../types/filters';
import { LISTING_SORT_SHORT } from '../../types/filters';
import { useAuth } from '../../hooks/useAuth';
import { useSearch } from '../../contexts/SearchContext';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { getUserFlowErrorMessage } from '../../lib/user-flow-errors';
import { formatPrice } from '../../lib/formatPrice';
import { borderRadius, colors, spacing, typography } from '../../theme/tokens';

const PAGE_SIZE = 20;
const FOCUS_REFETCH_STALE_MS = 45_000;
const HOMEPAGE_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..900,0..100&family=Inter:wght@400;500;600;700&display=swap';
const landingTextFont =
  Platform.OS === 'web'
    ? { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
    : undefined;
const landingDisplayFont =
  Platform.OS === 'web' ? { fontFamily: 'Fraunces, Georgia, serif' } : undefined;

type WebHandoffPrompt = {
  key: 'create-listing' | 'save-listing';
  title: string;
  body: string;
  path: string;
  buttonLabel: string;
};

function HomeFooter({ isCompact }: { isCompact: boolean }) {
  return (
    <View style={[styles.homeFooter, isCompact && styles.homeFooterCompact]}>
      <View style={styles.homeFooterBrandRow}>
        <View style={styles.homeFooterDot} />
        <Text style={[styles.homeFooterBrand, landingTextFont]}>PolyBuys</Text>
      </View>
      <Text style={[styles.homeFooterCopy, landingTextFont]} numberOfLines={isCompact ? 2 : 1}>
        Built for campus buying and selling.
      </Text>
    </View>
  );
}

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
  const { searchQuery: contextSearchQuery, clearSearch } = useSearch();
  const { width } = useWindowDimensions();
  const entranceStyle = useEntranceAnimation();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= 1024;
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

  // On web: use the shared context search query (instant, no URL round-trip).
  // On native: fall back to URL param q (native doesn't use SearchContext).
  const searchQuery = isWeb
    ? contextSearchQuery.trim()
    : (Array.isArray(q) ? (q[0] ?? '') : (q ?? '')).trim();

  const [filters, setFilters] = useState<Filters>({});
  const [sortBy, setSortBy] = useState<ListingSortBy>('newest');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPricePicker, setShowPricePicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [webHandoffPrompt, setWebHandoffPrompt] = useState<WebHandoffPrompt | null>(null);

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
        setWebHandoffPrompt({
          key: 'save-listing',
          title: 'Save listings in the mobile app',
          body: 'Bookmarks and saved listings are available in the PolyBuys mobile app.',
          path: `/listings/${listingId}`,
          buttonLabel: 'Open Listing in App',
        });
        return;
      }

      if (!isAuthenticated) {
        router.replace('/auth/login?returnTo=%2Fhome' as never);
        return;
      }

      try {
        await toggleSavedListing({ listingId });
      } catch (error) {
        Alert.alert('Save Failed', getUserFlowErrorMessage(error, 'save-listing'));
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

  const handleClearPrice = () => {
    setFilters((prev) => ({ ...prev, minPrice: undefined, maxPrice: undefined }));
  };

  const handleClearAll = () => {
    setFilters({});
    setSortBy('newest');
    clearSearch();
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
      setWebHandoffPrompt({
        key: 'create-listing',
        title: 'Create listings in the mobile app',
        body: 'Posting items is available in the PolyBuys mobile app.',
        path: '/listings/new',
        buttonLabel: 'Open Create Listing in App',
      });
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to create a listing', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign In',
          onPress: () => router.replace('/auth/login?returnTo=%2Fhome' as never),
        },
      ]);
      return;
    }
    router.push('/listings/new');
  };

  const handleBrowseSignIn = useCallback(() => {
    router.replace('/auth/login?returnTo=%2Fhome' as never);
  }, [router]);

  const getPriceLabel = () => {
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      return `${formatPrice(filters.minPrice)} – ${formatPrice(filters.maxPrice)}`;
    }
    if (filters.minPrice !== undefined) return `${formatPrice(filters.minPrice)}+`;
    if (filters.maxPrice !== undefined) return `Under ${formatPrice(filters.maxPrice)}`;
    return 'Price';
  };

  const isCompactLayout = width < 760;
  const webScrollHorizontalPadding =
    width >= 1280 ? spacing.xl : width >= 900 ? spacing.lg : width >= 480 ? spacing.lg : spacing.md;
  /** Native: same horizontal inset as My Listings (header + FilterBar). */
  const nativeHeaderHorizontalPadding =
    width >= 900 ? spacing.xxl : isCompactLayout ? spacing.md : spacing.lg;
  /** Native: original Home card gutters (tighter than header). */
  const nativeListHorizontalPadding =
    width >= 900 ? spacing.xxl : isCompactLayout ? spacing.xs : spacing.sm;
  const contentMaxWidth = isWeb ? 1280 : 1120;
  const homeColumns = isWeb ? (width >= 1280 ? 4 : width >= 920 ? 3 : width >= 680 ? 2 : 1) : 2;
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
                  ? 'Getting the latest listings'
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
                  ? 'Pulling in fresh items from campus.'
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
  const loadingFooterComponent = isLoadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={[styles.footerText, landingTextFont]}>Loading more...</Text>
    </View>
  ) : null;
  const webRows = buildWebRows(listings, homeColumns);

  if (isWeb) {
    return (
      <>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={HOMEPAGE_FONT_HREF} />
        </Head>

        <View style={[styles.page, styles.pageWeb]}>
          {/* Layered homepage background. */}
          <HomeBg />
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
                paddingHorizontal: webScrollHorizontalPadding,
                paddingBottom: Math.max(insets.bottom + 60, 80),
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}

            <Animated.View style={[styles.webHeaderSection, entranceStyle]}>
              <View style={styles.webToolbarRow}>
                <View style={styles.webToolbarCopy}>
                  <Text style={[styles.webToolbarTitle, landingDisplayFont]}>
                    {hasSearchQuery ? `Results for "${searchQuery}"` : 'Latest listings'}
                  </Text>
                  <Text style={[styles.webToolbarBody, landingTextFont]}>
                    {hasSearchQuery
                      ? 'Use filters to narrow the results further.'
                      : 'Fresh campus listings from the PolyBuys marketplace.'}
                  </Text>
                </View>
              </View>

              <CategoryRail
                selectedCategory={filters.category}
                onSelectCategory={handleCategorySelect}
                onClearSearch={clearSearch}
                priceLabel={getPriceLabel()}
                hasPrice={filters.minPrice !== undefined || filters.maxPrice !== undefined}
                onPricePress={() => setShowPricePicker(true)}
                onClearPrice={handleClearPrice}
                sortLabel={LISTING_SORT_SHORT[sortBy]}
                hasNonDefaultSort={sortBy !== 'newest'}
                onSortPress={() => setShowSortPicker(true)}
                hasAnyFilter={hasActiveFilters || sortBy !== 'newest'}
                onClearAll={handleClearAll}
              />
            </Animated.View>

            {webHandoffPrompt ? (
              <OpenInAppPrompt
                key={webHandoffPrompt.key}
                variant="card"
                title={webHandoffPrompt.title}
                body={webHandoffPrompt.body}
                path={webHandoffPrompt.path}
                buttonLabel={webHandoffPrompt.buttonLabel}
                secondaryActionLabel="Keep browsing"
                onSecondaryAction={() => setWebHandoffPrompt(null)}
                cardStyle={styles.webHandoffCard}
              />
            ) : null}

            {listings.length === 0 ? (
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
                          />
                        </View>
                      ))}
                      {row.fillerKeys.map((fillerKey) => (
                        <View key={fillerKey} style={styles.webGridItem} />
                      ))}
                    </View>
                  ))}
                </View>
                {loadingFooterComponent}
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
                    <Text style={[styles.webLoadMoreButtonText, landingTextFont]}>
                      Load more listings
                    </Text>
                  </Pressable>
                ) : null}
                {isDone && listings.length > 0 ? (
                  <View style={styles.allCaughtUp}>
                    <View style={styles.allCaughtUpLine} />
                    <Text style={[styles.allCaughtUpText, landingTextFont]}>
                      {"You're all caught up"}
                    </Text>
                    <View style={styles.allCaughtUpLine} />
                  </View>
                ) : null}
              </>
            )}

            <HomeFooter isCompact={isCompactLayout} />
          </ScrollView>
        </View>
      </>
    );
  }

  return (
    <View style={[styles.page, styles.pageMobile]}>
      <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        <Animated.View
          style={[
            styles.homeTopBlock,
            entranceStyle,
            { paddingHorizontal: nativeHeaderHorizontalPadding },
          ]}
        >
          <ScreenHeader
            title="Browse"
            subtitle={
              isAuthenticated
                ? 'Fresh listings from campus'
                : 'Browse as guest. Sign in to save listings, message sellers, and post items.'
            }
            action={
              <Pressable
                style={({ pressed }) => [styles.createChip, pressed && styles.createChipPressed]}
                onPress={isAuthenticated ? handleCreateListing : handleBrowseSignIn}
                disabled={isSessionLoading}
                accessibilityLabel={isAuthenticated ? 'Create listing' : 'Sign in'}
                accessibilityRole="button"
              >
                <Text style={styles.createChipText}>
                  {isAuthenticated ? '+ Create' : 'Sign In'}
                </Text>
              </Pressable>
            }
          />
          <CategoryRail
            selectedCategory={filters.category}
            onSelectCategory={handleCategorySelect}
            onClearSearch={clearSearch}
            priceLabel={getPriceLabel()}
            hasPrice={filters.minPrice !== undefined || filters.maxPrice !== undefined}
            onPricePress={() => setShowPricePicker(true)}
            onClearPrice={handleClearPrice}
            sortLabel={LISTING_SORT_SHORT[sortBy]}
            hasNonDefaultSort={sortBy !== 'newest'}
            onSortPress={() => setShowSortPicker(true)}
            hasAnyFilter={hasActiveFilters || sortBy !== 'newest'}
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
            {
              paddingBottom: Math.max(insets.bottom + 60, 80),
              paddingHorizontal: nativeListHorizontalPadding,
            },
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
          ListFooterComponent={
            <>
              {loadingFooterComponent}
              <HomeFooter isCompact={isCompactLayout} />
            </>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F7F5EF',
  },
  pageMobile: {
    backgroundColor: colors.surface,
  },
  pageWeb: {
    minHeight: '100%',
    position: 'relative',
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
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  webHeaderSection: {
    gap: spacing.xs,
    paddingBottom: 0,
  },
  webToolbarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  webToolbarCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  webToolbarTitle: {
    ...typography.title1,
    color: colors.textDark,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '500',
    letterSpacing: 0,
  },
  webToolbarBody: {
    ...typography.subhead,
    color: colors.muted,
    fontSize: 13,
  },
  webGrid: {
    gap: spacing.md,
  },
  webHandoffCard: {
    maxWidth: '100%',
  },
  webGridItem: {
    flex: 1,
    minWidth: 0,
  },
  webLoadMoreButton: {
    alignSelf: 'center',
    minHeight: 44,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(21, 71, 52, 0.18)',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 1px 4px rgba(21, 71, 52, 0.06)',
  } as never,
  webLoadMoreButtonText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0,
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
    gap: spacing.md,
  },
  columnWrapperCompact: {
    gap: spacing.sm,
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
    letterSpacing: 0,
  },
  // ── "All caught up" end-of-feed indicator ──
  allCaughtUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  allCaughtUpLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(21, 71, 52, 0.10)',
  },
  allCaughtUpText: {
    ...typography.footnote,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0,
    flexShrink: 0,
  },
  homeFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(21, 71, 52, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  homeFooterCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 6,
  },
  homeFooterBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  homeFooterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    boxShadow: '0 0 0 3px rgba(226, 168, 74, 0.18)',
  } as never,
  homeFooterBrand: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0,
  },
  homeFooterCopy: {
    ...typography.footnote,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
    flexShrink: 1,
  },
});
