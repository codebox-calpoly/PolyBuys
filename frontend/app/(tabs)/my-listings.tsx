import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from 'convex/_generated/api';
import type { Doc, Id } from 'convex/_generated/dataModel';
import ListingCard from '../../components/ListingCard';
import MyListingActionsSheet, {
  type MyListingAction,
  type MyListingActionTarget,
} from '../../components/MyListingActionsSheet';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';

type StatusFilter = 'all' | 'active' | 'inactive' | 'sold';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'sold', label: 'Sold' },
];

function getStatusLabel(status: Doc<'listings'>['status']) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'sold':
      return 'Sold';
    case 'inactive':
      return 'Inactive';
    case 'deleted':
      return 'Deleted';
    default: {
      const exhaustiveStatus: never = status;
      return exhaustiveStatus;
    }
  }
}

export default function MyListingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isSessionLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const myListings = useQuery(api.listings.getMyListings, isAuthenticated && !isWeb ? {} : 'skip');
  const deleteListing = useMutation(api.listings.deleteListing);
  const updateListingStatus = useMutation(api.listings.updateListingStatus);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [processingListingId, setProcessingListingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  function showError(message: string) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message);
      return;
    }
    Alert.alert('Error', message);
  }

  useEffect(() => {
    if (!isWeb && !isSessionLoading && !isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Fmy-listings' as never);
    }
  }, [isAuthenticated, isSessionLoading, isWeb, router]);

  function closeActionSheet() {
    setSelectedListingId(null);
  }

  async function handleSetStatus(
    id: string,
    status: Extract<Doc<'listings'>['status'], 'active' | 'inactive'>
  ) {
    const nextLabel = status === 'active' ? 'active' : 'inactive';
    try {
      setProcessingListingId(id);
      await updateListingStatus({ id: id as Id<'listings'>, status });
    } catch {
      showError(`Failed to mark listing as ${nextLabel}. Please try again.`);
    } finally {
      setProcessingListingId(null);
    }
  }

  async function handleMarkSold(id: string, title: string) {
    const confirmed =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(`Mark "${title}" as sold? This cannot be undone.`)
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Mark as sold', `Mark "${title}" as sold? This cannot be undone.`, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Mark sold', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
      setProcessingListingId(id);
      await updateListingStatus({ id: id as Id<'listings'>, status: 'sold' });
    } catch {
      showError('Failed to mark listing as sold. Please try again.');
    } finally {
      setProcessingListingId(null);
    }
  }

  async function handleDelete(id: string, title: string) {
    const confirmed =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)
        : await new Promise<boolean>((resolve) =>
            Alert.alert(
              'Delete listing',
              `Are you sure you want to delete "${title}"? This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
              ]
            )
          );

    if (!confirmed) return;

    try {
      setProcessingListingId(id);
      await deleteListing({ id: id as Id<'listings'> });
    } catch {
      showError('Failed to delete listing. Please try again.');
    } finally {
      setProcessingListingId(null);
    }
  }

  function handleActionFromSheet(action: MyListingAction, listing: MyListingActionTarget) {
    closeActionSheet();
    switch (action) {
      case 'edit':
        router.push(`/listings/${listing._id}/edit` as never);
        return;
      case 'markSold':
        void handleMarkSold(listing._id, listing.title);
        return;
      case 'markInactive':
        void handleSetStatus(listing._id, 'inactive');
        return;
      case 'markActive':
        void handleSetStatus(listing._id, 'active');
        return;
      case 'delete':
        void handleDelete(listing._id, listing.title);
        return;
      default: {
        const exhaustiveAction: never = action;
        return exhaustiveAction;
      }
    }
  }

  const isCompactLayout = width < 760;
  const columnCount = width >= 1200 ? 3 : isCompactLayout ? 1 : 2;
  const contentPadding = width >= 900 ? spacing.xxl : isCompactLayout ? spacing.md : spacing.lg;
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

  if (isWeb) {
    return (
      <OpenInAppPrompt
        title="Manage listings in the mobile app"
        body="Create, edit, and manage your listings from PolyBuys on mobile."
        path="/my-listings"
        buttonLabel="Open My Listings in App"
        secondaryActionLabel="Back to home"
        onSecondaryAction={() => router.replace('/')}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.page}>
        <View style={[styles.centeredState, { paddingTop: topSafeSpace }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Redirecting to login...</Text>
        </View>
      </View>
    );
  }

  if (myListings === undefined) {
    return (
      <View style={styles.page}>
        <View style={[styles.centeredState, { paddingTop: topSafeSpace }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your listings...</Text>
        </View>
      </View>
    );
  }

  const manageableListings = myListings.filter((l) => l.status !== 'deleted');
  const filteredListings =
    statusFilter === 'all'
      ? manageableListings
      : manageableListings.filter((listing) => listing.status === statusFilter);
  const selectedListing =
    selectedListingId === null
      ? null
      : (manageableListings.find((listing) => listing._id === selectedListingId) ?? null);
  const subtitleText =
    statusFilter === 'all'
      ? `${manageableListings.length} ${manageableListings.length === 1 ? 'listing' : 'listings'}`
      : `${filteredListings.length} ${statusFilter} ${
          filteredListings.length === 1 ? 'listing' : 'listings'
        }`;

  return (
    <View style={styles.page}>
      <View style={[styles.content, { paddingHorizontal: contentPadding }]}>
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        <Animated.View style={[styles.headerRow, entranceStyle]}>
          <View style={styles.headerCopy}>
            <Text style={styles.sectionTitle}>My Listings</Text>
            <Text style={styles.sectionSubtitle}>{subtitleText}</Text>
          </View>
          {manageableListings.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.createChip, pressed && styles.createChipPressed]}
              onPress={() => router.push('/listings/new')}
            >
              <Text style={styles.createChipText}>+ Create listing</Text>
            </Pressable>
          )}
        </Animated.View>

        {manageableListings.length > 0 && (
          <View style={styles.filterBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {STATUS_FILTERS.map((filter) => {
                const count =
                  filter.value === 'all'
                    ? manageableListings.length
                    : manageableListings.filter((listing) => listing.status === filter.value)
                        .length;
                const isSelected = statusFilter === filter.value;
                return (
                  <Pressable
                    key={filter.value}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                      pressed && styles.filterChipPressed,
                    ]}
                    onPress={() => setStatusFilter(filter.value)}
                  >
                    <Text
                      style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
                    >
                      {filter.label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {manageableListings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptyText}>Create your first listing to get started.</Text>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={() => router.push('/listings/new')}
            >
              <Text style={styles.primaryButtonText}>+ Create listing</Text>
            </Pressable>
          </View>
        ) : filteredListings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No {statusFilter} listings</Text>
            <Text style={styles.emptyText}>Try a different filter or create a new listing.</Text>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={styles.secondaryButtonText}>Show all listings</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            key={`my-listings-${columnCount}`}
            data={filteredListings}
            keyExtractor={(item) => item._id}
            numColumns={columnCount}
            columnWrapperStyle={columnCount > 1 ? styles.columnWrapper : undefined}
            contentContainerStyle={[
              styles.listContainer,
              { paddingBottom: insets.bottom + spacing.xxl },
            ]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <ListingCard
                listing={item}
                index={index}
                onPress={() => router.push(`/listings/${item._id}` as never)}
                footer={
                  <View style={styles.cardFooter}>
                    <View style={styles.statusGroup}>
                      <View style={[styles.statusChip, getStatusChipStyle(item.status)]}>
                        <Text style={[styles.statusText, getStatusTextStyle(item.status)]}>
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                      {item.isHidden === true && (
                        <View style={styles.hiddenChip}>
                          <Text style={styles.hiddenText}>Hidden</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.footerActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.manageButton,
                          pressed && styles.buttonPressed,
                          processingListingId === item._id && styles.buttonDisabled,
                        ]}
                        onPress={() => setSelectedListingId(item._id)}
                        disabled={processingListingId === item._id}
                        accessibilityRole="button"
                        accessibilityLabel={`Manage ${item.title}`}
                      >
                        {processingListingId === item._id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Text style={styles.manageButtonText}>Manage</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                }
              />
            )}
          />
        )}
      </View>
      <MyListingActionsSheet
        visible={selectedListing !== null}
        listing={selectedListing}
        onClose={closeActionSheet}
        onAction={handleActionFromSheet}
      />
    </View>
  );
}

function getStatusChipStyle(status: Doc<'listings'>['status']) {
  switch (status) {
    case 'active':
      return { backgroundColor: colors.location };
    case 'sold':
      return { backgroundColor: colors.border };
    case 'inactive':
      return { backgroundColor: colors.border };
    case 'deleted':
      return { backgroundColor: colors.border };
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return {};
    }
  }
}

function getStatusTextStyle(status: Doc<'listings'>['status']) {
  switch (status) {
    case 'active':
      return { color: colors.primary };
    case 'sold':
      return { color: colors.muted };
    case 'inactive':
      return { color: colors.muted };
    case 'deleted':
      return { color: colors.muted };
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return {};
    }
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.subhead,
    color: colors.text,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    ...typography.title1,
    color: colors.textDark,
  },
  sectionSubtitle: {
    ...typography.footnoteMed,
    color: colors.text,
    marginTop: 2,
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  filterBar: {
    minHeight: 44,
    justifyContent: 'center',
  },
  filterChip: {
    height: 38,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.footnoteMed,
    color: colors.textDark,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.white,
  },
  filterChipPressed: {
    opacity: 0.88,
  },
  listContainer: {
    paddingTop: spacing.xs,
  },
  columnWrapper: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyState: {
    paddingTop: spacing.xxl * 2,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.textDark,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.subhead,
    color: colors.text,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.footnoteMed,
    color: colors.white,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  secondaryButtonText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 44,
  },
  statusGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.footnoteMed,
    fontWeight: '600',
  },
  hiddenChip: {
    backgroundColor: colors.category,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hiddenText: {
    ...typography.footnoteMed,
    fontWeight: '600',
    color: colors.white,
  },
  footerActions: {
    marginLeft: spacing.xs,
  },
  manageButton: {
    minHeight: 36,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  manageButtonText: {
    ...typography.footnoteMed,
    color: colors.primary,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});
