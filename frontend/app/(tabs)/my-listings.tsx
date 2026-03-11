import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import ListingCard from '../../components/ListingCard';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

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
  const { isAuthenticated, isLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const myListings = useQuery(api.listings.getMyListings, isAuthenticated ? {} : 'skip');
  const deleteListing = useMutation(api.listings.deleteListing);
  const updateListingStatus = useMutation(api.listings.updateListingStatus);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);

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
      setMarkingSoldId(id);
      await updateListingStatus({ id: id as Id<'listings'>, status: 'sold' });
    } catch {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Failed to mark listing as sold. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to mark listing as sold. Please try again.');
      }
    } finally {
      setMarkingSoldId(null);
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
      setDeletingId(id);
      await deleteListing({ id: id as Id<'listings'> });
    } catch {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Failed to delete listing. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete listing. Please try again.');
      }
    } finally {
      setDeletingId(null);
    }
  }

  const contentPadding = width >= 900 ? spacing.xxl : spacing.lg;
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

  if (!isAuthenticated) {
    return (
      <View style={styles.page}>
        <View style={[styles.centeredState, { paddingTop: topSafeSpace }]}>
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptyText}>Sign in to view and manage your listings.</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => router.push('/auth/login?returnTo=%2Fmy-listings' as never)}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
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

  const displayListings = myListings.filter((l) => l.status !== 'deleted');

  return (
    <View style={styles.page}>
      <View style={[styles.content, { paddingHorizontal: contentPadding }]}>
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        <Animated.View style={[styles.headerRow, entranceStyle]}>
          <Text style={styles.sectionTitle}>My Listings</Text>
          <Pressable
            style={({ pressed }) => [styles.createChip, pressed && styles.createChipPressed]}
            onPress={() => router.push('/listings/new')}
          >
            <Text style={styles.createChipText}>+ Create</Text>
          </Pressable>
        </Animated.View>

        {displayListings.length === 0 ? (
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
        ) : (
          <FlatList
            data={displayListings}
            keyExtractor={(item) => item._id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item, index }) => (
              <ListingCard
                listing={item}
                index={index}
                onPress={() => router.push(`/listings/${item._id}` as never)}
                footer={
                  <View style={styles.cardFooter}>
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
                    {item.status === 'active' && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.markSoldButton,
                          pressed && styles.buttonPressed,
                          markingSoldId === item._id && styles.buttonDisabled,
                        ]}
                        onPress={() => handleMarkSold(item._id, item.title)}
                        disabled={markingSoldId === item._id}
                        accessibilityLabel="Mark as sold"
                        accessibilityRole="button"
                      >
                        {markingSoldId === item._id ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={styles.markSoldButtonText}>Mark sold</Text>
                        )}
                      </Pressable>
                    )}
                    <Pressable
                      style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
                      onPress={() => router.push(`/listings/${item._id}/edit` as never)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => handleDelete(item._id, item.title)}
                      disabled={deletingId === item._id}
                    >
                      {deletingId === item._id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      )}
                    </Pressable>
                  </View>
                }
              />
            )}
          />
        )}
      </View>
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
    backgroundColor: colors.background,
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
  sectionTitle: {
    ...typography.title1,
    flex: 1,
    color: colors.textDark,
  },
  createChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
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
  listContainer: {
    paddingBottom: spacing.xxl,
  },
  columnWrapper: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.footnoteMed,
    color: colors.white,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statusChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.footnote,
    fontWeight: '600',
  },
  hiddenChip: {
    backgroundColor: colors.category,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hiddenText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.white,
  },
  markSoldButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markSoldButtonText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.white,
  },
  editButton: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  editButtonText: {
    ...typography.footnoteMed,
    color: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  deleteButton: {
    backgroundColor: colors.destructive,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
