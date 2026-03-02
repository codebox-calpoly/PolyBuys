import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ListingCard from '../../components/ListingCard';
import type { Doc } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const entranceStyle = useEntranceAnimation();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
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

  const listingsResult = useQuery(api.listings.searchAndFilterListings, {
    filters: {
      searchTerm: searchTerm.length > 0 ? searchTerm : undefined,
      sortBy: 'newest',
    },
    paginationOpts: {
      numItems: PAGE_SIZE,
      cursor,
    },
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

  const handleLoadMore = useCallback(() => {
    if (!isDone && !isLoadingMore && listingsResult?.continueCursor) {
      setIsLoadingMore(true);
      setCursor(listingsResult.continueCursor);
    }
  }, [isDone, isLoadingMore, listingsResult?.continueCursor]);

  const isInitialLoading =
    listingsResult === undefined && cursor === null && allListings.length === 0;
  const showEmptyState = !isInitialLoading && allListings.length === 0;
  const contentPadding = width >= 900 ? 24 : 14;
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

  return (
    <View style={styles.page}>
      <FlatList
        data={allListings}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => <ListingCard listing={item} index={index} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: contentPadding, paddingTop: topSafeSpace + 16 },
          (isInitialLoading || showEmptyState) && styles.listContentCentered,
        ]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <Animated.View style={[styles.header, entranceStyle]}>
            <Text style={styles.title}>Search listings instantly</Text>
            <Text style={styles.subtitle}>Find by title, topic, or keyword.</Text>
            <View style={[styles.searchInputWrap, isInputFocused && styles.searchInputWrapFocused]}>
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Try: desk, calculator, bike..."
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          isInitialLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color="#154734" />
              <Text style={styles.stateText}>Loading listings...</Text>
            </View>
          ) : (
            <View style={styles.stateContainer}>
              <Text style={styles.emptyTitle}>Nothing matched yet</Text>
              <Text style={styles.stateText}>
                {searchTerm.length > 0
                  ? `No listings found for "${searchTerm}".`
                  : 'Try searching for what you need.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#154734" />
              <Text style={styles.footerText}>Loading more...</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f3f7f5',
  },
  listContent: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingBottom: 26,
  },
  listContentCentered: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f2b21',
  },
  subtitle: {
    fontSize: 15,
    color: '#5c6f66',
    marginBottom: 4,
  },
  searchInputWrap: {
    borderWidth: 1,
    borderColor: '#d4e1db',
    borderRadius: 14,
    backgroundColor: '#f8fbf9',
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  searchInputWrapFocused: {
    borderColor: '#2a7a57',
    backgroundColor: '#ffffff',
  },
  searchInput: {
    fontSize: 16,
    paddingVertical: 12,
  },
  stateContainer: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#1a2f26',
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    color: '#667972',
    fontSize: 15,
    textAlign: 'center',
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
