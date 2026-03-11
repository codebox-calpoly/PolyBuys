import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Doc } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import ListingCard from '../../components/ListingCard';
import { ReportModal } from '../../components/ReportModal';
import { ScreenState } from '../../components/ScreenState';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

function yearToOrdinal(gradYear: number): string {
  const currentYear = new Date().getFullYear();
  const yearsLeft = gradYear - currentYear;
  const yearNum = Math.max(1, Math.min(4, 4 - yearsLeft));
  const ordinals = ['', '1st', '2nd', '3rd', '4th'];
  return `${ordinals[yearNum]} Year`;
}

export default function PublicProfileScreen() {
  const { userId: rawUserId } = useLocalSearchParams<{ userId?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, isAuthenticated } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  let resolvedUserId: string | null = null;
  if (typeof rawUserId === 'string') {
    const trimmedUserId = rawUserId.trim();
    if (trimmedUserId.length > 0) {
      try {
        resolvedUserId = decodeURIComponent(trimmedUserId);
      } catch {
        resolvedUserId = null;
      }
    }
  }

  const profile = useQuery(
    api.profiles.getProfileByUserId,
    resolvedUserId ? { userId: resolvedUserId } : 'skip'
  );
  const listings = useQuery(
    api.listings.getListingsBySeller,
    resolvedUserId ? { sellerId: resolvedUserId } : 'skip'
  );
  const { mappedUrls: avatarUrls } = useResolvedImageUrls(
    profile?.picture ? [profile.picture] : []
  );
  const avatarUrl = avatarUrls[0];
  const isWideLayout = width >= 980;
  const canReportProfile =
    isAuthenticated && resolvedUserId !== null && user?._id !== resolvedUserId;

  if (!resolvedUserId) {
    return (
      <View style={styles.centered}>
        <ScreenState variant="error" title="Invalid profile" onRetry={() => router.back()} />
      </View>
    );
  }

  if (profile === undefined || listings === undefined) {
    return (
      <View style={styles.centered}>
        <ScreenState variant="loading" title="Loading profile..." />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <ScreenState
          variant="empty"
          title="Profile not found"
          message="This profile may be private or no longer exists."
          onRetry={() => router.back()}
        />
      </View>
    );
  }

  const yearLabel = yearToOrdinal(profile.year);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.profileCard}>
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
            <Text style={styles.listingsCount}>
              {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
            </Text>
          </View>
        </View>

        {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

        {canReportProfile && (
          <Pressable
            style={({ pressed }) => [styles.reportButton, pressed && styles.reportButtonPressed]}
            onPress={() => setReportOpen(true)}
            hitSlop={6}
          >
            <Text style={styles.reportButtonText}>Report</Text>
          </Pressable>
        )}
      </View>

      <ReportModal
        isVisible={canReportProfile && reportOpen}
        onClose={() => setReportOpen(false)}
        targetId={profile._id}
        targetType="profile"
      />

      <Text style={styles.sectionTitle}>Listings</Text>
      <View style={[styles.grid, isWideLayout && styles.gridWide]}>
        {listings.map((listing: Doc<'listings'>, index: number) => (
          <View key={listing._id} style={isWideLayout ? styles.gridItem : styles.gridItemFull}>
            <ListingCard listing={listing} index={index} />
          </View>
        ))}
      </View>
      {listings.length === 0 && <Text style={styles.emptyListings}>No active listings</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  listingsCount: {
    ...typography.footnote,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  bioText: {
    ...typography.subhead,
    color: colors.text,
    lineHeight: 22,
  },
  reportButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportButtonPressed: {
    opacity: 0.7,
  },
  reportButtonText: {
    ...typography.footnote,
    color: colors.destructive,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.title2,
    color: colors.textDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
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
    flexBasis: '48%',
  },
  emptyListings: {
    ...typography.subhead,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
