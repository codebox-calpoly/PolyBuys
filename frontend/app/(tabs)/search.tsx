import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const contentPadding = width >= 900 ? spacing.xxl : spacing.lg;
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;
  const isWideLayout = width >= 980;

  return (
    <View style={styles.page}>
      <View style={[styles.searchHeader, { paddingTop: topSafeSpace + spacing.md }]}>
        <View style={styles.searchBarWrap}>
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
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
      </View>

      {showRecentSearches ? (
        <View style={[styles.content, { paddingHorizontal: contentPadding }]}>
          <Text style={styles.sectionTitle}>Recent searches</Text>
          {recent.length === 0 ? (
            <Text style={styles.emptyRecent}>No recent searches yet.</Text>
          ) : (
            <View style={styles.recentList}>
              {recent.map((term) => (
                <Pressable
                  key={term}
                  style={({ pressed }) => [styles.recentItem, pressed && styles.recentItemPressed]}
                  onPress={() => handleRecentPress(term)}
                >
                  <Text style={styles.recentItemText}>{term}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : isSearching ? (
        <FlatList
          key={isWideLayout ? 'wide' : 'narrow'}
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
          numColumns={isWideLayout ? 2 : 1}
          columnWrapperStyle={isWideLayout ? styles.columnWrapper : undefined}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: contentPadding },
            (isInitialLoading || showEmptyResults) && styles.listContentCentered,
          ]}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.stateContainer}>
              <ScreenState
                variant={isInitialLoading ? 'loading' : 'empty'}
                title={isInitialLoading ? 'Searching...' : 'Nothing matched'}
                message={isInitialLoading ? undefined : `No listings found for "${searchTerm}".`}
              />
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
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  searchInput: {
    ...typography.body,
    paddingVertical: spacing.sm,
    color: colors.textDark,
  },
  content: {
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  emptyRecent: {
    ...typography.subhead,
    color: colors.muted,
  },
  recentList: {
    gap: spacing.xs,
  },
  recentItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
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
  },
  listContentCentered: {
    flexGrow: 1,
  },
  columnWrapper: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  stateContainer: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
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
