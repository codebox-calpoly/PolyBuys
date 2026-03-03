import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from 'convex/_generated/api';
import type { Doc } from '../../../backend/convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';

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
  const { isAuthenticated, isLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const myListings = useQuery(api.listings.getMyListings, isAuthenticated ? {} : 'skip');

  if (!isAuthenticated) {
    return (
      <View style={styles.centeredState}>
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
    );
  }

  if (myListings === undefined) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.loadingText}>Loading your listings...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={myListings}
      keyExtractor={(item) => item._id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <Animated.View style={[styles.heroCard, entranceStyle]}>
          <Text style={styles.eyebrow}>My Listings</Text>
          <Text style={styles.title}>Manage what you have posted</Text>
          <Text style={styles.subtitle}>
            View your listing statuses and jump into edits quickly.
          </Text>
        </Animated.View>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No listings yet</Text>
          <Text style={styles.emptyText}>Create your first listing from the Home tab.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.price}>${item.price}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.statusChip}>
              <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
            </View>
            {item.isHidden === true && (
              <View style={styles.hiddenChip}>
                <Text style={styles.hiddenText}>Hidden</Text>
              </View>
            )}
          </View>
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={() => router.push(`/listings/${item._id}`)}
            >
              <Text style={styles.secondaryButtonText}>View</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={() => router.push(`/listings/${item._id}/edit`)}
            >
              <Text style={styles.primaryButtonText}>Edit</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centeredState: {
    flex: 1,
    backgroundColor: '#f3f7f5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    color: '#5f7268',
  },
  listContent: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 26,
    gap: 12,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 6,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 12,
    color: '#2a6f52',
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f2b21',
  },
  subtitle: {
    fontSize: 15,
    color: '#556a60',
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dde8e2',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#163429',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#5e7268',
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dde8e2',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#123428',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a7f4d',
  },
  description: {
    fontSize: 14,
    color: '#51665c',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    backgroundColor: '#edf4ff',
    borderWidth: 1,
    borderColor: '#d1dffa',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2d5ab5',
  },
  hiddenChip: {
    backgroundColor: '#fff3f3',
    borderWidth: 1,
    borderColor: '#f3d0d0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hiddenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b3261e',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#154734',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#154734',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5fbf8',
  },
  secondaryButtonText: {
    color: '#154734',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});
