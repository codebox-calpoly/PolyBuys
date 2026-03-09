import { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import ListingCard from '../../components/ListingCard';
import { ScreenState } from '../../components/ScreenState';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import type { Doc } from 'convex/_generated/dataModel';

function yearToOrdinal(gradYear: number): string {
  const currentYear = new Date().getFullYear();
  const yearsLeft = gradYear - currentYear;
  const yearNum = Math.max(1, Math.min(4, 4 - yearsLeft));
  const ordinals = ['', '1st', '2nd', '3rd', '4th'];
  return `${ordinals[yearNum]} Year`;
}

type TabId = 'listings' | 'saved';

const DEFAULT_APP_ORIGIN = 'https://polybuys.com';

function getAppOrigin() {
  const configuredOrigin = process.env.EXPO_PUBLIC_APP_ORIGIN?.trim();
  if (!configuredOrigin) return DEFAULT_APP_ORIGIN;
  return configuredOrigin.endsWith('/') ? configuredOrigin.slice(0, -1) : configuredOrigin;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const entranceStyle = useEntranceAnimation();

  const [activeTab, setActiveTab] = useState<TabId>('listings');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profile = useQuery(api.profiles.getCurrentProfile, isAuthenticated ? {} : 'skip');
  const myListings = useQuery(api.listings.getMyListings, isAuthenticated ? {} : 'skip');
  const savedArgs = isAuthenticated && activeTab === 'saved' ? {} : 'skip';
  const {
    results: savedListings,
    status: savedListingsStatus,
    loadMore: loadMoreSavedListings,
  } = usePaginatedQuery(api.savedListings.getMySavedListings, savedArgs, { initialNumItems: 20 });
  const toggleSavedListing = useMutation(api.savedListings.toggleSavedListing);
  const { mappedUrls: avatarUrls } = useResolvedImageUrls(
    profile?.picture ? [profile.picture] : []
  );
  const avatarUrl = avatarUrls[0];

  const listingsCount = myListings?.filter((l) => l.status === 'active').length ?? 0;
  const itemsSoldCount = myListings?.filter((l) => l.status === 'sold').length ?? 0;
  const displayListings: Doc<'listings'>[] =
    myListings?.filter((l): l is Doc<'listings'> => l.status !== 'deleted') ?? [];
  const isWideLayout = width >= 980;

  const handleShareProfile = async () => {
    if (!profile?.userId) return;
    const shareUrl = `${getAppOrigin()}/profile/${encodeURIComponent(profile.userId)}`;
    try {
      await Share.share({
        message: `Check out my PolyBuys profile! ${shareUrl}`,
        url: shareUrl,
        title: 'My PolyBuys Profile',
      });
    } catch {
      // User cancelled or share failed
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Fsettings' as never);
    }
  }, [isAuthenticated, isLoading, router]);

  const handleAuthAction = async () => {
    if (!isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Fsettings' as never);
      return;
    }

    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sign out';
      Alert.alert('Sign Out Failed', message);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.loadingState}>
        <ScreenState variant="loading" title="Redirecting to login..." />
      </View>
    );
  }

  if (profile === undefined) {
    return (
      <View style={styles.loadingState}>
        <ScreenState variant="loading" title="Loading profile..." />
      </View>
    );
  }

  if (!profile) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.centeredState}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Animated.View style={[styles.signInCard, entranceStyle]}>
          <Text style={styles.signInTitle}>Complete your profile</Text>
          <Text style={styles.signInBody}>
            Add your name, major, and year to start selling on PolyBuys.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => router.push('/profile/edit')}
          >
            <Text style={styles.primaryButtonText}>Set up profile</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    );
  }

  const yearLabel = yearToOrdinal(profile.year);

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Animated.View style={[styles.profileCard, entranceStyle]}>
        <View style={styles.profileHeader}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileMeta}>
              {profile.major} • {yearLabel}
            </Text>
            <View style={styles.statsRow}>
              <Text style={styles.statNumber}>{listingsCount}</Text>
              <Text style={styles.statLabel}> Listings</Text>
              <Text style={styles.statNumber}>{itemsSoldCount}</Text>
              <Text style={styles.statLabel}> Items Sold</Text>
            </View>
          </View>
        </View>

        {profile.bio ? (
          <View style={styles.bioRow}>
            <Text style={styles.bioText}>{profile.bio}</Text>
            <Pressable
              style={({ pressed }) => [styles.editIcon, pressed && { opacity: 0.7 }]}
              onPress={() => router.push('/profile/edit')}
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
            >
              <Text style={styles.editIconText}>✎</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.addBioRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/profile/edit')}
          >
            <Text style={styles.addBioText}>Add a bio...</Text>
            <Text style={styles.editIconText}>✎</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.shareButton, pressed && styles.buttonPressed]}
          onPress={handleShareProfile}
        >
          <Text style={styles.shareButtonText}>Share Profile</Text>
        </Pressable>
      </Animated.View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'listings' && styles.tabActive]}
          onPress={() => setActiveTab('listings')}
          accessibilityLabel="My listings"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'listings' }}
        >
          <Text style={[styles.tabText, activeTab === 'listings' && styles.tabTextActive]}>
            Listings
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
          onPress={() => setActiveTab('saved')}
          accessibilityLabel="Saved listings"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'saved' }}
        >
          <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>Saved</Text>
        </Pressable>
      </View>

      {activeTab === 'listings' ? (
        <View style={[styles.grid, isWideLayout && styles.gridWide]}>
          {displayListings.map((listing, index) => (
            <View key={listing._id} style={isWideLayout ? styles.gridItem : styles.gridItemFull}>
              <ListingCard listing={listing} index={index} />
            </View>
          ))}
        </View>
      ) : savedListingsStatus === 'LoadingFirstPage' ? (
        <View style={styles.emptyTab}>
          <ScreenState variant="loading" title="Loading saved listings..." />
        </View>
      ) : savedListings.length === 0 ? (
        <View style={styles.emptyTab}>
          <Text style={styles.emptyTabTitle}>No saved listings</Text>
          <Text style={styles.emptyTabBody}>Save listings you like to find them quickly here.</Text>
        </View>
      ) : (
        <View style={[styles.grid, isWideLayout && styles.gridWide]}>
          {savedListings.map((item, index) =>
            item.listing ? (
              <View key={item._id} style={isWideLayout ? styles.gridItem : styles.gridItemFull}>
                <ListingCard
                  listing={item.listing}
                  index={index}
                  isSaved
                  onToggleSave={() => void toggleSavedListing({ listingId: item.listingId })}
                  badge={
                    item.listing?.status === 'sold'
                      ? 'sold'
                      : item.isUnavailable
                        ? 'unavailable'
                        : undefined
                  }
                />
              </View>
            ) : null
          )}
          {savedListingsStatus === 'CanLoadMore' && (
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={() => loadMoreSavedListings(20)}
              accessibilityRole="button"
              accessibilityLabel="Load more saved listings"
            >
              <Text style={styles.secondaryButtonText}>Load more</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
            (isSigningOut || isLoading) && styles.buttonDisabled,
          ]}
          onPress={handleAuthAction}
          disabled={isSigningOut || isLoading}
        >
          <Text style={styles.secondaryButtonText}>
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  signInCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    gap: spacing.md,
    maxWidth: 400,
  },
  signInTitle: {
    ...typography.title1,
    color: colors.textDark,
    textAlign: 'center',
  },
  signInBody: {
    ...typography.subhead,
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    shadowColor: colors.textDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.border,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    ...typography.title1,
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  profileName: {
    ...typography.title1,
    fontSize: 24,
    color: colors.textDark,
  },
  profileMeta: {
    ...typography.subhead,
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
    gap: 2,
  },
  statNumber: {
    ...typography.title2,
    fontSize: 18,
    color: colors.textDark,
  },
  statLabel: {
    ...typography.footnote,
    color: colors.text,
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bioText: {
    flex: 1,
    ...typography.subhead,
    color: colors.text,
    lineHeight: 22,
  },
  editIcon: {
    padding: spacing.xs,
  },
  editIconText: {
    fontSize: 14,
    color: colors.muted,
  },
  addBioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  addBioText: {
    ...typography.subhead,
    color: colors.muted,
  },
  shareButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  shareButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.white,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.location,
  },
  tabText: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: colors.textDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  gridWide: {
    gap: spacing.lg,
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
  },
  gridItemFull: {
    width: '100%',
  },
  emptyTab: {
    backgroundColor: colors.surface,
    flexBasis: '48%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTabTitle: {
    ...typography.heading,
    color: colors.textDark,
  },
  emptyTabBody: {
    ...typography.subhead,
    color: colors.text,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  secondaryButtonText: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
