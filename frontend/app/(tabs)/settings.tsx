import { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import ListingCard from '../../components/ListingCard';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import ProfileAvatar from '../../components/ProfileAvatar';
import { ScreenState } from '../../components/ScreenState';
import { FilterChips, type FilterChipOption } from '../../components/ui';
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

const TAB_OPTIONS: FilterChipOption<TabId>[] = [
  { value: 'listings', label: 'Listings' },
  { value: 'saved', label: 'Saved' },
];

const PROFILE_EDIT = '/profile/edit';
const ACCOUNT_SETTINGS = '/account-settings';

export default function SettingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isSessionLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;
  const [activeTab, setActiveTab] = useState<TabId>('listings');
  const profile = useQuery(api.profiles.getCurrentProfile, isAuthenticated && !isWeb ? {} : 'skip');
  const myListings = useQuery(api.listings.getMyListings, isAuthenticated && !isWeb ? {} : 'skip');
  const savedArgs = isAuthenticated && !isWeb && activeTab === 'saved' ? {} : 'skip';
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

  useEffect(() => {
    if (!isWeb && !isSessionLoading && !isAuthenticated) {
      router.replace('/auth/login' as never);
    }
  }, [isAuthenticated, isSessionLoading, isWeb, router]);

  if (isWeb) {
    return (
      <OpenInAppPrompt
        title="Open your profile in the mobile app"
        body="Profile, saved listings, and account settings are currently available in the PolyBuys mobile app."
        path="/settings"
        buttonLabel="Open Profile in App"
        secondaryActionLabel="Back to home"
        onSecondaryAction={() => router.replace('/')}
      />
    );
  }

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
        contentInsetAdjustmentBehavior="never"
      >
        <Animated.View style={[styles.signInCard, entranceStyle]}>
          <Text style={styles.signInTitle}>Complete your profile</Text>
          <Text style={styles.signInBody}>
            Add your name, major, and year to start selling on PolyBuys.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => router.push(PROFILE_EDIT as never)}
          >
            <Text style={styles.primaryButtonText}>Set up profile</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.settingsRow, pressed && styles.buttonPressed]}
            onPress={() => router.push(ACCOUNT_SETTINGS as never)}
            accessibilityRole="button"
            accessibilityLabel="Account settings"
          >
            <Text style={styles.settingsRowLabel}>Account settings</Text>
            <Text style={styles.settingsRowChevron}>›</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    );
  }

  const yearLabel = yearToOrdinal(profile.year);

  const profileSubtitle = `${profile.major} • ${yearLabel}`;

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={styles.content}
    >
      {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
      <Animated.View style={[styles.profileBlock, entranceStyle]}>
        <View style={styles.profileHeader}>
          <ProfileAvatar uri={avatarUrl} name={profile.name} size={72} style={styles.avatar} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileMeta}>{profileSubtitle}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{listingsCount}</Text>
                <Text style={styles.statLabel}>Listings</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{itemsSoldCount}</Text>
                <Text style={styles.statLabel}>Items Sold</Text>
              </View>
            </View>
          </View>
        </View>

        {profile.bio ? (
          <View style={styles.bioRow}>
            <Text style={styles.bioText}>{profile.bio}</Text>
            <Pressable
              style={({ pressed }) => [styles.editIcon, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(PROFILE_EDIT as never)}
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
            >
              <Text style={styles.editIconText}>✎</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.addBioRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(PROFILE_EDIT as never)}
          >
            <Text style={styles.addBioText}>Add a bio...</Text>
            <Text style={styles.editIconText}>✎</Text>
          </Pressable>
        )}

        <View style={styles.profileActions}>
          <Pressable
            style={({ pressed }) => [styles.secondaryPill, pressed && styles.buttonPressed]}
            onPress={() => router.push(PROFILE_EDIT as never)}
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
          >
            <Text style={styles.secondaryPillText}>Edit profile</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryPill, pressed && styles.buttonPressed]}
            onPress={() => router.push(ACCOUNT_SETTINGS as never)}
            accessibilityRole="button"
            accessibilityLabel="Account settings"
          >
            <Text style={styles.secondaryPillText}>Settings</Text>
          </Pressable>
        </View>
      </Animated.View>

      <FilterChips options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'listings' ? (
        displayListings.length === 0 ? (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyTabTitle}>No listings</Text>
            <Text style={styles.emptyTabBody}>
              Post your first listing to find them quickly here.
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, isWideLayout && styles.gridWide]}>
            {displayListings.map((listing, index) => (
              <View key={listing._id} style={isWideLayout ? styles.gridItem : styles.gridItemFull}>
                <ListingCard listing={listing} index={index} />
              </View>
            ))}
          </View>
        )
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  signInCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
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
  profileBlock: {
    gap: spacing.md,
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
    gap: spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
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
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingsRowLabel: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textDark,
  },
  settingsRowChevron: {
    fontSize: 22,
    color: colors.muted,
    fontWeight: '300',
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  editIconText: {
    fontSize: 18,
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
  profileActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPillText: {
    ...typography.footnoteMed,
    color: colors.textDark,
    fontWeight: '600',
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
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
});
