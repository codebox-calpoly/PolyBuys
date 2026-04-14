import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ListingCard from '../../components/ListingCard';
import { ScreenState } from '../../components/ScreenState';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useRecentSearches } from '../../hooks/useRecentSearches';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= 1024;
  const { isAuthenticated } = useAuth();
  const { recent, loaded, addRecent } = useRecentSearches();
  const toggleSavedListing = useMutation(api.savedListings.toggleSavedListing);

  const inputRef = useRef<TextInput>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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
      inputRef.current?.focus();
    }, [])
  );

  useEffect(() => {
    filterVersionRef.current += 1;
    currentFilterVersionRef.current = filterVersionRef.current;
    setCursor(null);
    setAllListings([]);
    setIsDone(false);
    setIsLoadingMore(false);
    processedCursorsRef.current.clear();
  }, [searchTerm]);

  const queryFilterVersion = currentFilterVersionRef.current;

  const listingsResult = useQuery(
    api.listings.searchAndFilterListings,
    searchTerm.length > 0
      ? {
          filters: {
            searchTerm,
            sortBy: 'newest',
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
    isAuthenticated && allListings.length > 0
      ? { listingIds: allListings.map((l) => l._id) }
      : 'skip'
  );

  const handleToggleSave = useCallback(
    (listingId: Id<'listings'>) => {
      if (!isAuthenticated) {
        router.replace('/auth/login?returnTo=%2Fsearch' as never);
        return;
      }
      void toggleSavedListing({ listingId });
    },
    [isAuthenticated, router, toggleSavedListing]
  );

  const handleRecentPress = useCallback((term: string) => {
    setSearchInput(term);
    inputRef.current?.focus();
  }, []);

  const handleListingPress = useCallback(
    (listing: Doc<'listings'>) => {
      if (searchTerm.length > 0) {
        addRecent(searchTerm);
      }
      router.push(`/listings/${listing._id}` as never);
    },
    [searchTerm, addRecent, router]
  );

  const isSearching = searchTerm.length > 0;
  const isInitialLoading =
    isSearching && listingsResult === undefined && cursor === null && allListings.length === 0;
  const showEmptyResults = isSearching && !isInitialLoading && allListings.length === 0;
  const showRecentSearches = !isSearching && loaded;
  const contentPadding = isDesktopWeb ? spacing.xl : width >= 900 ? spacing.xxl : spacing.lg;
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;
  const searchColumns = isWeb ? (width >= 1280 ? 3 : width >= 900 ? 2 : 1) : width >= 980 ? 2 : 1;
  const contentMaxWidth = isWeb ? 1240 : 980;
  const resultsContentLayoutStyle = {
    paddingHorizontal: contentPadding,
    maxWidth: contentMaxWidth,
  } as const;

  return (
    <View style={styles.page}>
      <View style={[styles.searchHeader, { paddingTop: topSafeSpace + spacing.md }]}>
        <View style={[styles.searchHeaderInner, { maxWidth: contentMaxWidth }]}>
          {isDesktopWeb ? (
            <View style={styles.searchHeaderCopy}>
              <Text style={styles.searchEyebrow}>Search</Text>
              <Text style={styles.searchTitle}>Find exactly what you need</Text>
              <Text style={styles.searchBody}>
                Search by title or keywords to narrow the campus marketplace in seconds.
              </Text>
            </View>
          ) : null}
          <View style={[styles.searchBarWrap, isDesktopWeb && styles.searchBarWrapDesktop]}>
            <TextInput
              ref={inputRef}
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search desk, calculator, bike..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (searchInput.trim().length > 0) {
                  addRecent(searchInput.trim());
                }
                Keyboard.dismiss();
              }}
            />
          </View>
        </View>
      </View>

      {showRecentSearches ? (
        <View
          style={[
            styles.content,
            {
              paddingHorizontal: contentPadding,
              maxWidth: contentMaxWidth,
            },
          ]}
        >
          <View style={styles.recentCard}>
            <Text style={styles.sectionTitle}>
              {recent.length > 0 ? 'Recent searches' : 'Start with a quick search'}
            </Text>
            <Text style={styles.recentIntro}>
              {recent.length > 0
                ? 'Jump back into something you searched for recently.'
                : 'Search across listings for desks, calculators, bikes, textbooks, and more.'}
            </Text>
            {recent.length === 0 ? (
              <Text style={styles.emptyRecent}>No recent searches yet.</Text>
            ) : (
              <View style={styles.recentList}>
                {recent.map((term) => (
                  <Pressable
                    key={term}
                    style={({ pressed }) => [
                      styles.recentItem,
                      pressed && styles.recentItemPressed,
                    ]}
                    onPress={() => handleRecentPress(term)}
                  >
                    <Text style={styles.recentItemText}>{term}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : isSearching ? (
        <FlatList
          key={`search-${searchColumns}`}
          data={allListings}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => (
            <ListingCard
              listing={item}
              index={index}
              isSaved={savedState?.[item._id] ?? false}
              onToggleSave={() => handleToggleSave(item._id)}
              onPress={() => handleListingPress(item)}
            />
          )}
          numColumns={searchColumns}
          columnWrapperStyle={searchColumns > 1 ? styles.columnWrapper : undefined}
          contentContainerStyle={[
            styles.listContent,
            resultsContentLayoutStyle,
            (isInitialLoading || showEmptyResults) && styles.listContentCentered,
          ]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View style={styles.resultsHeader}>
              <Text style={styles.sectionTitle}>Search results</Text>
              <Text style={styles.resultsTitle}>
                {isInitialLoading
                  ? `Searching for "${searchTerm}"...`
                  : `${allListings.length} result${allListings.length === 1 ? '' : 's'} for "${searchTerm}"`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.stateContainer}>
              <View style={styles.stateCard}>
                <ScreenState
                  variant={isInitialLoading ? 'loading' : 'empty'}
                  title={isInitialLoading ? 'Searching...' : 'Nothing matched'}
                  message={isInitialLoading ? undefined : `No listings found for "${searchTerm}".`}
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchHeaderInner: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
  },
  searchHeaderCopy: {
    gap: spacing.xs,
  },
  searchEyebrow: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  searchTitle: {
    ...typography.title1,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textDark,
  },
  searchBody: {
    ...typography.subhead,
    color: colors.text,
  },
  searchBarWrap: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
  searchBarWrapDesktop: {
    minHeight: 56,
    borderRadius: borderRadius.lg,
    boxShadow: '0 14px 32px rgba(21, 71, 52, 0.08)',
  },
  searchInput: {
    ...typography.body,
    paddingVertical: spacing.sm,
    color: colors.textDark,
  },
  content: {
    paddingTop: spacing.xl,
    width: '100%',
    alignSelf: 'center',
  },
  sectionTitle: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  recentCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
    boxShadow: '0 18px 40px rgba(21, 71, 52, 0.06)',
  },
  recentIntro: {
    ...typography.subhead,
    color: colors.text,
  },
  emptyRecent: {
    ...typography.subhead,
    color: colors.muted,
  },
  recentList: {
    gap: spacing.sm,
  },
  recentItem: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  recentItemPressed: {
    backgroundColor: colors.location,
  },
  recentItemText: {
    ...typography.body,
    color: colors.textDark,
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
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
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
