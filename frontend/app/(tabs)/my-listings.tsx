import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from 'convex/_generated/api';
import type { Doc, Id } from 'convex/_generated/dataModel';
import ListingCard, { type ListingCardStatusBadge } from '../../components/ListingCard';
import MyListingActionsSheet, {
  type MyListingAction,
  type MyListingActionTarget,
} from '../../components/MyListingActionsSheet';
import { useAuth } from '../../hooks/useAuth';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import { showAlert } from '../../utils/showAlert';
import { FilterChips, ScreenHeader, type FilterChipOption } from '../../components/ui';

type StatusFilter = 'all' | 'active' | 'inactive' | 'sold';

const STATUS_FILTER_OPTIONS: FilterChipOption<StatusFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'sold', label: 'Sold' },
];

function statusToBadge(
  status: Doc<'listings'>['status'],
  isHidden: boolean
): ListingCardStatusBadge | undefined {
  if (isHidden) return 'hidden';
  switch (status) {
    case 'active':
      return 'active';
    case 'inactive':
      return 'inactive';
    case 'sold':
      return 'sold';
    case 'deleted':
      return undefined;
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return undefined;
    }
  }
}

export default function MyListingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isSessionLoading } = useAuth();
  const myListings = useQuery(api.listings.getMyListings, isAuthenticated && !isWeb ? {} : 'skip');
  const deleteListing = useMutation(api.listings.deleteListing);
  const updateListingStatus = useMutation(api.listings.updateListingStatus);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [processingListingId, setProcessingListingId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

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
      showAlert('Error', `Failed to mark listing as ${nextLabel}. Please try again.`);
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
      showAlert('Error', 'Failed to mark listing as sold. Please try again.');
    } finally {
      setProcessingListingId(null);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (processingListingId !== null) return;

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
      showAlert('Error', 'Failed to delete listing. Please try again.');
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
  const columnCount = 2;
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

  const filterOptionsWithCounts: FilterChipOption<StatusFilter>[] = STATUS_FILTER_OPTIONS.map(
    (option) => {
      const count =
        option.value === 'all'
          ? manageableListings.length
          : manageableListings.filter((listing) => listing.status === option.value).length;
      return { ...option, label: `${option.label} (${count})` };
    }
  );

  return (
    <View style={styles.page}>
      <View style={[styles.content, { paddingHorizontal: contentPadding }]}>
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        <ScreenHeader
          title="My Listings"
          subtitle={subtitleText}
          action={
            manageableListings.length > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.createChip, pressed && styles.createChipPressed]}
                onPress={() => router.push('/listings/new')}
                accessibilityLabel="Create listing"
                accessibilityRole="button"
              >
                <Text style={styles.createChipText}>+ Create listing</Text>
              </Pressable>
            ) : null
          }
        />

        {manageableListings.length > 0 && (
          <FilterChips
            options={filterOptionsWithCounts}
            value={statusFilter}
            onChange={setStatusFilter}
          />
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
            renderItem={({ item, index }) => {
              const isProcessing = processingListingId === item._id;
              return (
                <ListingCard
                  listing={item}
                  index={index}
                  statusBadge={statusToBadge(item.status, item.isHidden === true)}
                  onManagePress={isProcessing ? undefined : () => setSelectedListingId(item._id)}
                  onPress={() => router.push(`/listings/${item._id}` as never)}
                />
              );
            }}
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
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  deleteButton: {
    backgroundColor: '#b3261e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
