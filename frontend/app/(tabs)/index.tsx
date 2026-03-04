import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { MaterialIcons } from '@expo/vector-icons';
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
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

  // Hero/open animation layers
  const heroRevealStyle = useEntranceAnimation(0, 24);
  const statsRevealStyle = useEntranceAnimation(120, 24);
  const filtersRevealStyle = useEntranceAnimation(180, 16);

  const pulseValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulseValue]);

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
      Alert.alert('Sign In Required', 'Please sign in to create a listing', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }
    router.push('/listings/new');
  };

  const contentPadding = width >= 900 ? 24 : 14;
  const isWideLayout = width >= 980;

  const pulseScale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const pulseOpacity = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.3],
  });

  return (
    <View style={styles.page}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowOrb,
          {
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      <View style={[styles.content, { paddingHorizontal: contentPadding }]}> 
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}

        <Animated.View style={[styles.heroCard, heroRevealStyle]}>
          <View style={styles.heroBackdrop} />

          <View style={styles.heroText}>
            <View style={styles.badgeRow}>
              <View style={styles.liveDot} />
              <Text style={styles.eyebrow}>Cal Poly Marketplace</Text>
            </View>
            <Text style={styles.title}>The premium student marketplace experience.</Text>
            <Text style={styles.subtitle}>
              Discover trusted campus deals, move items fast, and connect with real students in a
              beautifully crafted local marketplace.
            </Text>
          </View>

          <View style={styles.heroActions}>
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
              <MaterialIcons name="add" size={18} color="#fff" />
              <Text style={styles.createButtonText}>Create Listing</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
              onPress={() => router.push('/(tabs)/search')}
            >
              <MaterialIcons name="travel-explore" size={17} color="#185f43" />
              <Text style={styles.secondaryButtonText}>Explore</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View style={[styles.quickStatsRow, statsRevealStyle]}>
          <View style={styles.statPill}>
            <MaterialIcons name="verified-user" size={15} color="#176448" />
            <Text style={styles.statPillText}>Trusted Campus Network</Text>
          </View>
          <View style={styles.statPill}>
            <MaterialIcons name="bolt" size={15} color="#176448" />
            <Text style={styles.statPillText}>Fast Local Pickup</Text>
          </View>
          <View style={styles.statPill}>
            <MaterialIcons name="savings" size={15} color="#176448" />
            <Text style={styles.statPillText}>Smarter Student Pricing</Text>
          </View>
        </Animated.View>

        <Animated.View style={filtersRevealStyle}>
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

        {listingsResult === undefined && cursor === null ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color="#154734" />
            <Text style={styles.loadingText}>Loading curated listings...</Text>
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyTitle}>
              {hasActiveFilters ? 'No listings match your filters' : 'No listings yet'}
            </Text>
            <Text style={styles.emptyText}>
              {hasActiveFilters
                ? 'Try a wider price range or fewer tags.'
                : 'Be the first to post something valuable for campus.'}
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
    backgroundColor: '#eef4f1',
  },
  glowOrb: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    right: -120,
    top: -80,
    backgroundColor: '#4fc58c',
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
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#cfe2d9',
    backgroundColor: '#ffffff',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.11,
    shadowRadius: 24,
    elevation: 4,
  },
  heroBackdrop: {
    position: 'absolute',
    right: -70,
    top: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#e3f5ec',
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#18b96f',
  },
  eyebrow: {
    fontSize: 12,
    color: '#2a6f52',
    letterSpacing: 0.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '800',
    color: '#102a21',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#4f6a5f',
    lineHeight: 22,
    maxWidth: 720,
  },
  heroActions: {
    gap: 10,
  },
  createButton: {
    backgroundColor: '#187549',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: 7,
  },
  createButtonWide: {
    minWidth: 178,
  },
  createButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#ecf8f2',
    borderWidth: 1,
    borderColor: '#cce8d8',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonText: {
    color: '#185f43',
    fontWeight: '700',
    fontSize: 14,
  },
  quickStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statPill: {
    backgroundColor: '#ffffff',
    borderColor: '#d4e4dc',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statPillText: {
    color: '#205c45',
    fontWeight: '600',
    fontSize: 13,
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
