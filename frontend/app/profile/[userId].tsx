import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Doc } from 'convex/_generated/dataModel';
import { useFlash } from '../../contexts/FlashContext';
import { useAuth } from '../../hooks/useAuth';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import ListingCard from '../../components/ListingCard';
import ProfileAvatar from '../../components/ProfileAvatar';
import { ReportModal } from '../../components/ReportModal';
import { ScreenState } from '../../components/ScreenState';
import { formatMajorLabel } from '../../constants/calPolyMajors';
import { REPORT_SUBMITTED_MESSAGE } from '../../constants/feedbackMessages';
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
  const { setFlash } = useFlash();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const { user, isAuthenticated } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
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
  const isOwnProfile = resolvedUserId !== null && user?._id === resolvedUserId;
  const canManageProfile = !isWeb && isAuthenticated && resolvedUserId !== null && !isOwnProfile;
  const canReportProfile = canManageProfile;
  const blockUser = useMutation(api.blocks.blockUser);
  const unblockUser = useMutation(api.blocks.unblockUser);
  const isBlockingProfile = useQuery(
    api.blocks.isBlocking,
    canManageProfile && resolvedUserId ? { blockedId: resolvedUserId } : 'skip'
  );

  const handleBlockPress = () => {
    if (!resolvedUserId || isUpdatingBlock || isBlockingProfile === undefined) {
      return;
    }

    const commitBlockChange = async (nextBlocked: boolean) => {
      setIsUpdatingBlock(true);
      try {
        if (nextBlocked) {
          const blockId = await blockUser({ blockedId: resolvedUserId });
          if (!blockId) {
            Alert.alert('User unavailable', 'This user is no longer available to block.');
            return;
          }
          setFlash('User blocked. You will no longer receive messages from this user.');
          return;
        }

        await unblockUser({ blockedId: resolvedUserId });
        setFlash('User unblocked.');
      } catch (error) {
        Alert.alert(
          nextBlocked ? 'Could not block' : 'Could not unblock',
          error instanceof Error ? error.message : 'Please try again.'
        );
      } finally {
        setIsUpdatingBlock(false);
      }
    };

    if (isBlockingProfile === true) {
      Alert.alert('Unblock user', 'Allow this user to message you again?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => void commitBlockChange(false) },
      ]);
      return;
    }

    Alert.alert(
      'Block user',
      'You will no longer receive messages from this user. They will not be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void commitBlockChange(true) },
      ]
    );
  };

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
          <ProfileAvatar uri={avatarUrl} name={profile.name} size={72} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileMeta}>
              {formatMajorLabel(profile.major)} • {yearLabel}
            </Text>
            <Text style={styles.listingsCount}>
              {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
            </Text>
          </View>
        </View>

        {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

        {canManageProfile && (
          <View style={styles.profileActions}>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                isBlockingProfile === true ? styles.unblockButton : styles.blockButton,
                pressed && styles.actionButtonPressed,
                (isUpdatingBlock || isBlockingProfile === undefined) && styles.actionButtonDisabled,
              ]}
              onPress={handleBlockPress}
              disabled={isUpdatingBlock || isBlockingProfile === undefined}
              accessibilityRole="button"
              accessibilityLabel={
                isBlockingProfile === true ? 'Unblock this user' : 'Block this user'
              }
            >
              <Text
                style={[
                  styles.actionButtonText,
                  isBlockingProfile === true ? styles.unblockButtonText : styles.blockButtonText,
                ]}
              >
                {isUpdatingBlock
                  ? isBlockingProfile === true
                    ? 'Unblocking...'
                    : 'Blocking...'
                  : isBlockingProfile === true
                    ? 'Unblock'
                    : 'Block'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.reportButton,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={() => setReportOpen(true)}
              disabled={isUpdatingBlock}
              accessibilityRole="button"
              accessibilityLabel="Report this profile"
            >
              <Text style={[styles.actionButtonText, styles.reportButtonText]}>Report</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ReportModal
        isVisible={canReportProfile && reportOpen}
        onClose={() => setReportOpen(false)}
        targetId={profile._id}
        targetType="profile"
        onReportSuccess={() => setFlash(REPORT_SUBMITTED_MESSAGE)}
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
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
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
  profileActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  actionButtonPressed: {
    opacity: 0.92,
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  actionButtonText: {
    ...typography.footnote,
    fontWeight: '600',
  },
  blockButton: {
    borderColor: 'rgba(179, 38, 30, 0.2)',
    backgroundColor: 'rgba(179, 38, 30, 0.06)',
  },
  blockButtonText: {
    color: colors.destructive,
  },
  unblockButton: {
    borderColor: 'rgba(21, 71, 52, 0.18)',
    backgroundColor: 'rgba(21, 71, 52, 0.06)',
  },
  unblockButtonText: {
    color: colors.primary,
  },
  reportButton: {
    borderColor: 'rgba(179, 38, 30, 0.2)',
    backgroundColor: colors.white,
  },
  reportButtonText: {
    color: colors.destructive,
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
