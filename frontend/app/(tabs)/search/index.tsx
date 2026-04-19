import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ListingCard from '../../../components/ListingCard';
import { ScreenState } from '../../../components/ScreenState';
import { SectionCard } from '../../../components/ui';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../../hooks/useAuth';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { CATEGORY_LABELS, type Category } from '../../../types/filters';
import { colors, typography, spacing, borderRadius } from '../../../theme/tokens';
import { searchFieldChrome } from '../../../theme/nativeChrome';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const USE_NATIVE_SEARCH_BAR = Platform.OS === 'ios';

const BROWSE_CATEGORIES: Category[] = ['textbooks', 'electronics', 'furniture', 'tickets', 'other'];
const QUICK_SEARCHES = ['Desk lamp', 'Bike', 'Calculator', 'Mini fridge'];
const CATEGORY_META: Record<
  Category,
  {
    icon: keyof typeof Feather.glyphMap;
    tint: string;
    accent: string;
    blurb: string;
  }
> = {
  textbooks: {
    icon: 'book-open',
    tint: '#EEF7F2',
    accent: colors.primary,
    blurb: 'Course books, notes, and study staples.',
  },
  electronics: {
    icon: 'monitor',
    tint: '#EDF5FF',
    accent: '#2F6FB2',
    blurb: 'Calculators, laptops, and dorm tech.',
  },
  furniture: {
    icon: 'home',
    tint: '#FFF5E8',
    accent: '#A86715',
    blurb: 'Desks, lamps, chairs, and room setup.',
  },
  tickets: {
    icon: 'tag',
    tint: '#FFF0F0',
    accent: '#B84C4C',
    blurb: 'Events, rides, and campus extras.',
  },
  other: {
    icon: 'shopping-bag',
    tint: '#F2F5F4',
    accent: '#587066',
    blurb: 'Everything else students are moving.',
  },
};

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const searchChrome = useMemo(() => searchFieldChrome(), []);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= 1024;
  const { isAuthenticated } = useAuth();
  const toggleSavedListing = useMutation(api.savedListings.toggleSavedListing);

  const inputRef = useRef<TextInput>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null);
  const [allListings, setAllListings] = useState<Doc<'listings'>[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const filterVersionRef = useRef(0);
  const currentFilterVersionRef = useRef(0);
  const processedCursorsRef = useRef(new Set<string>());

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  useFocusEffect(
    useCallback(() => {
      if (USE_NATIVE_SEARCH_BAR || Platform.OS === 'web') return;
      const id = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(id);
    }, [])
  );

  const clearSearchAndBrowse = useCallback(() => {
    setSearchInput('');
    setSearchTerm('');
    setCategoryFilter(null);
  }, []);

  useEffect(() => {
    filterVersionRef.current += 1;
    currentFilterVersionRef.current = filterVersionRef.current;
    setCursor(null);
    setAllListings([]);
    setIsDone(false);
    setIsLoadingMore(false);
    processedCursorsRef.current.clear();
  }, [searchTerm, categoryFilter]);

  const queryFilterVersion = currentFilterVersionRef.current;

  const shouldFetchListings = searchTerm.length > 0 || categoryFilter !== null;

  const listingsResult = useQuery(
    api.listings.searchAndFilterListings,
    shouldFetchListings
      ? {
          filters: {
            sortBy: 'newest',
            ...(searchTerm.length > 0 ? { searchTerm } : {}),
            ...(categoryFilter ? { category: categoryFilter } : {}),
          },
          paginationOpts: {
            numItems: PAGE_SIZE,
            cursor,
          },
        }
      : 'skip'
  );

  useEffect(() => {
    if (listingsResult && queryFilterVersion === filterVersionRef.current) {
      if (cursor === null) {
        setAllListings(listingsResult.page);
        setIsDone(listingsResult.isDone);
        setIsLoadingMore(false);
        return;
      }

      if (!processedCursorsRef.current.has(cursor)) {
        setAllListings((prev) => [...prev, ...listingsResult.page]);
        setIsDone(listingsResult.isDone);
        setIsLoadingMore(false);
        processedCursorsRef.current.add(cursor);
      }
    }
  }, [listingsResult, cursor, queryFilterVersion]);

  const handleLoadMore = useCallback(() => {
    if (!isDone && !isLoadingMore && listingsResult?.continueCursor) {
      setIsLoadingMore(true);
      setCursor(listingsResult.continueCursor);
    }
  }, [isDone, isLoadingMore, listingsResult?.continueCursor]);

  const savedState = useQuery(
    api.savedListings.getSavedStateForListings,
    isAuthenticated && !isWeb && allListings.length > 0
      ? { listingIds: allListings.map((l) => l._id) }
      : 'skip'
  );

  const handleToggleSave = useCallback(
    (listingId: Id<'listings'>) => {
      if (isWeb) {
        router.push('/auth/login?returnTo=%2Fsearch' as never);
        return;
      }

      if (!isAuthenticated) {
        router.replace('/auth/login?returnTo=%2Fsearch' as never);
        return;
      }
      void toggleSavedListing({ listingId });
    },
    [isAuthenticated, isWeb, router, toggleSavedListing]
  );

  const handleCategoryPress = useCallback((category: Category) => {
    setCategoryFilter(category);
  }, []);

  const handleQuickSearchPress = useCallback((query: string) => {
    setCategoryFilter(null);
    setSearchInput(query);
  }, []);

  const handleListingPress = useCallback(
    (listing: Doc<'listings'>) => {
      router.push(`/listings/${listing._id}` as never);
    },
    [router]
  );

  const hasActiveQuery = searchInput.trim().length > 0 || categoryFilter !== null;
  const isSearching = hasActiveQuery;
  const isInitialLoading =
    isSearching && listingsResult === undefined && cursor === null && allListings.length === 0;
  const showBrowseLanding = !hasActiveQuery;
  const contentPadding = isDesktopWeb ? spacing.xl : width >= 900 ? spacing.xxl : spacing.lg;
  const topSafeSpace =
    USE_NATIVE_SEARCH_BAR || Platform.OS === 'android' ? 0 : Math.max(insets.top - 6, 10);
  const searchColumns = isWeb ? (width >= 1280 ? 3 : width >= 900 ? 2 : 1) : width >= 980 ? 2 : 1;
  const contentMaxWidth = isWeb ? 1240 : 980;
  const browseCategoryColumns = width >= 900 ? 3 : width >= 520 ? 2 : 1;
  const browseCategoryWidth =
    browseCategoryColumns === 3 ? '31.8%' : browseCategoryColumns === 2 ? '48.2%' : '100%';
  const resultsContentLayoutStyle = {
    paddingHorizontal: contentPadding,
    maxWidth: contentMaxWidth,
  } as const;

  const resultsSubtitle = useMemo(() => {
    if (searchTerm.length > 0) {
      return isInitialLoading
        ? `Searching for "${searchTerm}"…`
        : `${allListings.length} result${allListings.length === 1 ? '' : 's'} for "${searchTerm}"`;
    }
    if (categoryFilter) {
      const label = CATEGORY_LABELS[categoryFilter];
      return isInitialLoading
        ? `Loading ${label}…`
        : `${allListings.length} active listing${allListings.length === 1 ? '' : 's'} in ${label}`;
    }
    return '';
  }, [searchTerm, categoryFilter, isInitialLoading, allListings.length]);

  const nativeSearchOptions = useMemo(
    () => ({
      headerSearchBarOptions: {
        placeholder: 'Search desk, calculator, bike…',
        autoFocus: true,
        hideWhenScrolling: false,
        obscureBackground: false,
        autoCapitalize: 'none' as const,
        autoCorrect: false,
        keyboardAppearance: searchChrome.keyboardAppearance,
        barTintColor: searchChrome.barTintColor,
        tintColor: colors.primary,
        textColor: searchChrome.textColor,
        hintTextColor: searchChrome.hintTextColor,
        onChangeText: (event: { nativeEvent: { text: string } }) => {
          setSearchInput(event.nativeEvent.text);
        },
        onCancelButtonPress: () => {
          clearSearchAndBrowse();
        },
      },
    }),
    [clearSearchAndBrowse, searchChrome]
  );

  const browseLanding = showBrowseLanding ? (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: contentPadding,
          maxWidth: contentMaxWidth,
        },
      ]}
    >
      <SectionCard
        title="Browse categories"
        subtitle="Tap a category to see the newest campus listings, or use a quick search below."
        style={styles.browseCard}
      >
        <View style={styles.categoryGrid}>
          {BROWSE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={({ pressed }) => [
                styles.categoryCard,
                { width: browseCategoryWidth, backgroundColor: CATEGORY_META[cat].tint },
                browseCategoryColumns === 2 &&
                  cat === BROWSE_CATEGORIES[BROWSE_CATEGORIES.length - 1] &&
                  styles.categoryCardCentered,
                pressed && styles.categoryCardPressed,
              ]}
              onPress={() => handleCategoryPress(cat)}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${CATEGORY_LABELS[cat]}`}
            >
              <View
                style={[styles.categoryIconWrap, { borderColor: `${CATEGORY_META[cat].accent}25` }]}
              >
                <Feather
                  name={CATEGORY_META[cat].icon}
                  size={16}
                  color={CATEGORY_META[cat].accent}
                />
              </View>
              <View style={styles.categoryCardCopy}>
                <Text style={styles.categoryChipText}>{CATEGORY_LABELS[cat]}</Text>
                <Text style={styles.categoryCardBody}>{CATEGORY_META[cat].blurb}</Text>
              </View>
              <Feather name="arrow-right" size={16} color={CATEGORY_META[cat].accent} />
            </Pressable>
          ))}
        </View>
      </SectionCard>
      <SectionCard
        title="Popular searches"
        subtitle="Try one of these common searches to get to good listings faster."
        style={styles.quickSearchCard}
      >
        <View style={styles.quickSearchGrid}>
          {QUICK_SEARCHES.map((query) => (
            <Pressable
              key={query}
              onPress={() => handleQuickSearchPress(query)}
              style={({ pressed }) => [
                styles.quickSearchChip,
                pressed && styles.quickSearchChipPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Search for ${query}`}
            >
              <Feather name="search" size={14} color={colors.primary} />
              <Text style={styles.quickSearchText}>{query}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>
    </ScrollView>
  ) : null;

  const resultsList = isSearching ? (
    <FlatList
      key={`search-${searchColumns}`}
      data={allListings}
      keyExtractor={(item) => item._id}
      renderItem={({ item, index }) => (
        <ListingCard
          listing={item}
          index={index}
          isSaved={savedState?.[item._id] ?? false}
          onToggleSave={isWeb ? undefined : () => handleToggleSave(item._id)}
          onPress={() => handleListingPress(item)}
        />
      )}
      numColumns={searchColumns}
      columnWrapperStyle={searchColumns > 1 ? styles.columnWrapper : undefined}
      contentContainerStyle={[
        styles.listContent,
        resultsContentLayoutStyle,
        isInitialLoading && styles.listContentCentered,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={styles.resultsHeader}>
          {categoryFilter && searchTerm.length === 0 ? (
            <Pressable
              onPress={() => setCategoryFilter(null)}
              style={styles.backToBrowseButton}
              accessibilityRole="button"
              accessibilityLabel="Back to categories"
            >
              <Feather name="arrow-left" size={15} color={colors.primary} />
              <Text style={styles.backToBrowseText}>Back to categories</Text>
            </Pressable>
          ) : null}
          <View style={styles.resultsHeaderTop}>
            <Text style={styles.sectionLabel}>
              {searchTerm.length > 0 ? 'Search' : categoryFilter ? 'Category' : 'Results'}
            </Text>
            {hasActiveQuery ? (
              <Pressable
                onPress={clearSearchAndBrowse}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search and category filter"
              >
                <Text style={styles.clearLink}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.resultsTitle}>{resultsSubtitle}</Text>
        </View>
      }
      ListEmptyComponent={
        <View
          style={[
            styles.stateContainer,
            isInitialLoading ? styles.stateContainerCentered : styles.stateContainerInline,
          ]}
        >
          <View style={styles.stateCard}>
            <ScreenState
              variant={isInitialLoading ? 'loading' : 'empty'}
              title={isInitialLoading ? 'Searching…' : 'Nothing matched'}
              message={
                isInitialLoading
                  ? undefined
                  : searchTerm.length > 0
                    ? `No listings found for "${searchTerm}".`
                    : categoryFilter
                      ? `No active listings in ${CATEGORY_LABELS[categoryFilter]} right now.`
                      : undefined
              }
            />
          </View>
        </View>
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
  ) : null;

  if (USE_NATIVE_SEARCH_BAR) {
    return (
      <View style={styles.page}>
        <Stack.Screen
          options={{
            title: 'Search',
            ...nativeSearchOptions,
          }}
        />
        {showBrowseLanding ? browseLanding : resultsList}
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.page}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.searchHeader, { paddingTop: topSafeSpace + spacing.md }]}>
          <View style={[styles.searchHeaderInner, { maxWidth: contentMaxWidth }]}>
            <View style={styles.searchHeaderCopy}>
              <Text style={styles.searchTitle}>Search</Text>
              <Text style={styles.searchBody}>
                {isDesktopWeb
                  ? 'Search by title or keywords, or pick a category below.'
                  : 'Find what you need across PolyBuys.'}
              </Text>
            </View>
            <View
              style={[
                styles.searchBarWrap,
                isDesktopWeb && styles.searchBarWrapDesktop,
                {
                  backgroundColor: searchChrome.searchBarWrapBackground,
                  borderColor: searchChrome.searchBarWrapBorder,
                },
              ]}
            >
              <BlurView
                intensity={60}
                tint={searchChrome.blurTint}
                style={StyleSheet.absoluteFill}
              />
              <Feather
                name="search"
                size={18}
                color={searchChrome.iconColor}
                style={styles.searchBarIcon}
              />
              <TextInput
                ref={inputRef}
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search desk, calculator, bike..."
                placeholderTextColor={searchChrome.hintTextColor}
                selectionColor={colors.primary}
                cursorColor={colors.primary}
                keyboardAppearance={searchChrome.keyboardAppearance}
                style={[styles.searchInput, { color: searchChrome.textColor }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                autoFocus={Platform.OS !== 'web'}
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                }}
              />
              {searchInput.length > 0 ? (
                <Pressable
                  onPress={clearSearchAndBrowse}
                  style={[
                    styles.searchClearButton,
                    { backgroundColor: searchChrome.clearButtonBackground },
                  ]}
                  hitSlop={8}
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                >
                  <Text style={styles.searchClearButtonText}>✕</Text>
                </Pressable>
              ) : null}
            </View>
            {categoryFilter ? (
              <Pressable
                onPress={() => setCategoryFilter(null)}
                style={styles.filterBanner}
                accessibilityRole="button"
                accessibilityLabel="Clear category filter"
              >
                <Text style={styles.filterBannerText}>
                  Filtering by {CATEGORY_LABELS[categoryFilter]}
                  <Text style={styles.filterBannerClear}> · Clear</Text>
                </Text>
              </Pressable>
            ) : null}
            {hasActiveQuery ? (
              <Pressable
                onPress={clearSearchAndBrowse}
                style={styles.searchResetButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search and category filter"
              >
                <Feather name="x-circle" size={16} color={colors.primary} />
                <Text style={styles.searchResetButtonText}>Clear search and filters</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {showBrowseLanding ? browseLanding : resultsList}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  searchHeaderInner: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
  },
  searchHeaderCopy: {
    gap: 2,
  },
  searchTitle: {
    ...typography.title1,
    color: colors.textDark,
  },
  searchBody: {
    ...typography.footnoteMed,
    color: colors.text,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  searchBarWrapDesktop: {
    minHeight: 58,
  },
  searchBarIcon: {
    marginRight: spacing.sm,
    opacity: 0.7,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.sm,
  },
  searchClearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  searchClearButtonText: {
    ...typography.footnote,
    fontSize: 12,
    color: colors.white,
    fontWeight: '700',
    lineHeight: 13,
  },
  searchResetButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: '#EAF7F0',
    borderWidth: 1,
    borderColor: colors.locationDark,
  },
  searchResetButtonText: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '700',
  },
  filterBanner: {
    alignSelf: 'flex-start',
  },
  filterBannerText: {
    ...typography.footnoteMed,
    color: colors.text,
  },
  filterBannerClear: {
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
  },
  browseCard: {
    backgroundColor: colors.white,
  },
  quickSearchCard: {
    backgroundColor: '#F3FBF7',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    minHeight: 116,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    boxShadow: '0 10px 24px rgba(21, 71, 52, 0.08)',
  },
  categoryCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.94,
  },
  categoryCardCentered: {
    alignSelf: 'center',
  },
  categoryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
  },
  categoryCardCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  categoryChipText: {
    ...typography.subhead,
    color: colors.textDark,
    fontWeight: '700',
    flexShrink: 1,
  },
  categoryCardBody: {
    ...typography.footnote,
    color: colors.text,
  },
  quickSearchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.smPlus,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.locationDark,
  },
  quickSearchChipPressed: {
    backgroundColor: '#EAF7F0',
  },
  quickSearchText: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '700',
  },
  sectionLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearLink: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  listContentCentered: {
    flexGrow: 1,
  },
  resultsHeader: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  backToBrowseButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: '#EAF7F0',
    borderWidth: 1,
    borderColor: colors.locationDark,
  },
  backToBrowseText: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '700',
  },
  resultsHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsTitle: {
    ...typography.heading,
    color: colors.textDark,
  },
  columnWrapper: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stateContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  stateContainerCentered: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
  },
  stateContainerInline: {
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
  },
  stateCard: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  footerLoader: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    marginTop: spacing.sm,
    ...typography.footnote,
    color: colors.text,
  },
});
