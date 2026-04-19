import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

type StatusFilter = 'pending' | 'reviewed' | 'dismissed';
type TargetTypeFilter = 'all' | 'listing' | 'profile';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function AdminModerationScreen() {
  const router = useRouter();
  const entranceStyle = useEntranceAnimation();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [targetTypeFilter, setTargetTypeFilter] = useState<TargetTypeFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = useQuery(api.admin.isCurrentUserAdmin, {});
  const stats = useQuery(api.admin.getStats, isAdmin ? {} : 'skip');
  const reports = useQuery(
    api.admin.getReports,
    isAdmin
      ? {
          status: statusFilter,
          targetType: targetTypeFilter === 'all' ? undefined : targetTypeFilter,
        }
      : 'skip'
  );

  const resolveReport = useMutation(api.admin.resolveReport);
  const unhideContent = useMutation(api.admin.unhideContent);

  const handleResolve = async (
    reportId: Id<'reports'>,
    resolution: 'reviewed' | 'dismissed',
    hide?: boolean
  ) => {
    setActionLoading(reportId);
    try {
      await resolveReport({ reportId, resolution, hideTarget: hide });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showAlert('Error', msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnhide = async (targetId: string, targetType: 'listing' | 'profile') => {
    setActionLoading(targetId);
    try {
      await unhideContent({ targetId, targetType });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showAlert('Error', msg);
    } finally {
      setActionLoading(null);
    }
  };

  // Loading state
  if (isAdmin === undefined) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorMessage}>You do not have admin privileges.</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View style={entranceStyle}>
        {/* Stats */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.pendingReports}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.reviewedReports}</Text>
              <Text style={styles.statLabel}>Reviewed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.dismissedReports}</Text>
              <Text style={styles.statLabel}>Dismissed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.hiddenListings + stats.hiddenProfiles}</Text>
              <Text style={styles.statLabel}>Hidden</Text>
            </View>
          </View>
        )}

        {/* Filters */}
        <View style={styles.filtersSection}>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.filterRow}>
            {(['pending', 'reviewed', 'dismissed'] as StatusFilter[]).map((s) => (
              <Pressable
                key={s}
                style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text
                  style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.filterLabel, { marginTop: spacing.md }]}>Type</Text>
          <View style={styles.filterRow}>
            {(['all', 'listing', 'profile'] as TargetTypeFilter[]).map((t) => (
              <Pressable
                key={t}
                style={[styles.filterChip, targetTypeFilter === t && styles.filterChipActive]}
                onPress={() => setTargetTypeFilter(t)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    targetTypeFilter === t && styles.filterChipTextActive,
                  ]}
                >
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Reports list */}
        <View style={styles.reportsSection}>
          <Text style={styles.sectionTitle}>Reports ({reports?.length ?? 0})</Text>

          {reports === undefined && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.loadingIndicator}
            />
          )}

          {reports?.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No {statusFilter} reports found.</Text>
            </View>
          )}

          {reports?.map((report) => (
            <View key={report._id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={styles.reportMeta}>
                  <View
                    style={[
                      styles.typeBadge,
                      report.targetType === 'listing'
                        ? styles.typeBadgeListing
                        : styles.typeBadgeProfile,
                    ]}
                  >
                    <Text style={styles.typeBadgeText}>
                      {report.targetType === 'listing' ? 'Listing' : 'Profile'}
                    </Text>
                  </View>
                  <View style={styles.reasonBadge}>
                    <Text style={styles.reasonBadgeText}>{report.reason}</Text>
                  </View>
                  {report.targetIsHidden && (
                    <View style={styles.hiddenBadge}>
                      <Text style={styles.hiddenBadgeText}>Hidden</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.reportDate}>{formatDate(report.createdAt)}</Text>
              </View>

              <Text style={styles.reportTarget} numberOfLines={2}>
                {report.targetTitle ?? 'Unknown target'}
              </Text>

              <Text style={styles.reportReporter}>Reported by: {report.reporterName}</Text>

              {report.notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText} numberOfLines={3}>
                    {report.notes}
                  </Text>
                </View>
              )}

              {/* Actions */}
              {(report.status ?? 'pending') === 'pending' && (
                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionDismiss,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => void handleResolve(report._id, 'dismissed')}
                    disabled={actionLoading === report._id}
                  >
                    <Text style={styles.actionDismissText}>Dismiss</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionReview,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => void handleResolve(report._id, 'reviewed', false)}
                    disabled={actionLoading === report._id}
                  >
                    <Text style={styles.actionReviewText}>Mark Reviewed</Text>
                  </Pressable>

                  {!report.targetIsHidden && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionHide,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => void handleResolve(report._id, 'reviewed', true)}
                      disabled={actionLoading === report._id}
                    >
                      <Text style={styles.actionHideText}>Hide & Resolve</Text>
                    </Pressable>
                  )}

                  {report.targetIsHidden && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        styles.actionUnhide,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => void handleUnhide(report.targetId, report.targetType)}
                      disabled={actionLoading === report.targetId}
                    >
                      <Text style={styles.actionUnhideText}>Unhide</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {report.status === 'reviewed' && report.targetIsHidden && (
                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionUnhide,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => void handleUnhide(report.targetId, report.targetType)}
                    disabled={actionLoading === report.targetId}
                  >
                    <Text style={styles.actionUnhideText}>Unhide Content</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 40,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.title1,
    color: colors.textDark,
  },
  errorMessage: {
    ...typography.subhead,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: colors.white,
    ...typography.body,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textDark,
  },
  statLabel: {
    ...typography.footnote,
    color: colors.text,
  },
  filtersSection: {
    marginBottom: spacing.xl,
  },
  filterLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.footnote,
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.white,
  },
  reportsSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.title1,
    fontSize: 18,
    color: colors.textDark,
    marginBottom: spacing.sm,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingIndicator: {
    marginTop: 20,
  },
  emptyText: {
    ...typography.subhead,
    color: colors.text,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  typeBadgeListing: {
    backgroundColor: colors.location,
  },
  typeBadgeProfile: {
    backgroundColor: colors.infoBg,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textDark,
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  reasonBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warningText,
  },
  hiddenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  hiddenBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.errorText,
  },
  reportDate: {
    ...typography.footnote,
    color: colors.muted,
  },
  reportTarget: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textDark,
  },
  reportReporter: {
    ...typography.footnote,
    color: colors.text,
  },
  notesBox: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesText: {
    ...typography.footnote,
    color: colors.text,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  actionDismiss: {
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  actionDismissText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
  },
  actionReview: {
    borderColor: colors.primary,
    backgroundColor: colors.location,
  },
  actionReviewText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.primary,
  },
  actionHide: {
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorBg,
  },
  actionHideText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.errorText,
  },
  actionUnhide: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  actionUnhideText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.primary,
  },
});
