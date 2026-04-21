import { useCallback, useEffect, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from 'convex/_generated/api';
import { useAuth } from '../hooks/useAuth';
import { requestPermissionAndSyncToken } from '../hooks/usePushNotifications';
import OpenInAppPrompt from '../components/OpenInAppPrompt';
import { ScreenState } from '../components/ScreenState';
import { formatMajorLabel } from '../constants/calPolyMajors';
import { getUserFlowErrorMessage } from '../lib/user-flow-errors';
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

type BlockedRow = {
  blockedId: string;
  name: string;
  major?: string;
};

export default function AccountSettingsScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const signOutInProgressRef = useRef(false);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [messageNotificationsValue, setMessageNotificationsValue] = useState(true);
  const [isUpdatingMessageNotifications, setIsUpdatingMessageNotifications] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const messageNotificationsEnabled = useQuery(
    api.users.getMessageNotificationsEnabled,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const blockedUsers = useQuery(
    api.blocks.listMyBlockedUsers,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const updateMessageNotificationsEnabled = useMutation(
    api.users.updateMessageNotificationsEnabled
  );
  const recordPushToken = useMutation(api.pushNotifications.recordPushToken);
  const removePushToken = useMutation(api.pushNotifications.removePushToken);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const unblockUser = useMutation(api.blocks.unblockUser);

  useEffect(() => {
    if (!isWeb && !isLoading && !isAuthenticated) {
      router.replace('/auth/login' as never);
    }
  }, [isAuthenticated, isLoading, isWeb, router]);

  useEffect(() => {
    if (typeof messageNotificationsEnabled === 'boolean') {
      setMessageNotificationsValue(messageNotificationsEnabled);
    }
  }, [messageNotificationsEnabled]);

  const handleSignOut = async () => {
    if (!isAuthenticated) {
      router.replace('/auth/login' as never);
      return;
    }

    if (signOutInProgressRef.current) {
      return;
    }

    try {
      signOutInProgressRef.current = true;
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      Alert.alert('Sign Out Failed', getUserFlowErrorMessage(error, 'sign-out'));
    } finally {
      signOutInProgressRef.current = false;
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'Are you sure? This will permanently delete your account and all your data. You can always sign back up later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount({});
            } catch (error) {
              Alert.alert(
                'Delete Account Failed',
                getUserFlowErrorMessage(error, 'delete-account')
              );
              return;
            }

            try {
              await signOut();
            } catch (error) {
              Alert.alert('Account Deleted', getUserFlowErrorMessage(error, 'post-delete-signout'));
            }
          },
        },
      ]
    );
  };

  const confirmUnblock = useCallback(
    (row: BlockedRow) => {
      Alert.alert(
        'Unblock',
        `Allow ${row.name} to message you again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: () => {
              void (async () => {
                setUnblockingId(row.blockedId);
                try {
                  await unblockUser({ blockedId: row.blockedId });
                } catch (err) {
                  Alert.alert('Could Not Unblock', getUserFlowErrorMessage(err, 'unblock-user'));
                } finally {
                  setUnblockingId(null);
                }
              })();
            },
          },
        ],
        { cancelable: true }
      );
    },
    [unblockUser]
  );

  const handleMessageNotificationsToggle = async (value: boolean) => {
    if (isUpdatingMessageNotifications) return;

    const previousValue = messageNotificationsValue;
    setMessageNotificationsValue(value);
    setIsUpdatingMessageNotifications(true);

    try {
      if (value) {
        let permissionGranted = false;
        try {
          permissionGranted = await requestPermissionAndSyncToken(recordPushToken);
        } catch (error) {
          setMessageNotificationsValue(previousValue);
          Alert.alert(
            'Notification Update Failed',
            getUserFlowErrorMessage(error, 'notifications-enable')
          );
          return;
        }

        if (!permissionGranted) {
          setMessageNotificationsValue(previousValue);
          Alert.alert(
            'Notification Update Failed',
            'Push permission was not granted. Enable notifications in system settings and try again.'
          );
          return;
        }

        try {
          await updateMessageNotificationsEnabled({ enabled: true });
        } catch (error) {
          setMessageNotificationsValue(previousValue);
          Alert.alert(
            'Notification Update Failed',
            getUserFlowErrorMessage(error, 'notifications-enable')
          );
        }
      } else {
        let removePushTokenSucceeded = false;
        let removePushTokenError: unknown = null;
        try {
          await removePushToken({});
          removePushTokenSucceeded = true;
        } catch (error) {
          removePushTokenError = error;
        }

        try {
          await updateMessageNotificationsEnabled({ enabled: false });
          if (!removePushTokenSucceeded) {
            Alert.alert(
              'Notifications Turned Off',
              'Notifications were turned off for your account, but this device may still receive a few alerts for a short time.'
            );
          }
        } catch (error) {
          if (removePushTokenSucceeded) {
            Alert.alert(
              'Notification Preference Not Saved',
              'This device was updated, but we could not save your account preference. Try again in a moment.'
            );
            return;
          }

          setMessageNotificationsValue(previousValue);
          Alert.alert(
            'Notification Update Failed',
            getUserFlowErrorMessage(error ?? removePushTokenError, 'notifications-disable')
          );
          return;
        }
      }
    } finally {
      setIsUpdatingMessageNotifications(false);
    }
  };

  const blockedListCount = blockedUsers?.length ?? 0;

  const renderBlockedItem: ListRenderItem<BlockedRow> = useCallback(
    ({ item, index }) => {
      const busy = unblockingId === item.blockedId;
      const isFirst = index === 0;
      const isLast = index === blockedListCount - 1;
      return (
        <View
          style={[
            styles.blockedRow,
            isFirst && styles.blockedRowFirst,
            isLast && styles.blockedRowLast,
            !isLast && styles.blockedRowWithSeparator,
          ]}
        >
          <View style={styles.blockedRowText}>
            <Text style={styles.blockedName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.major ? (
              <Text style={styles.blockedMajor} numberOfLines={1}>
                {formatMajorLabel(item.major)}
              </Text>
            ) : null}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.unblockButton,
              pressed && styles.buttonPressed,
              busy && styles.buttonDisabled,
            ]}
            onPress={() => confirmUnblock(item)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Unblock ${item.name}`}
          >
            {busy ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.unblockButtonText}>Unblock</Text>
            )}
          </Pressable>
        </View>
      );
    },
    [blockedListCount, confirmUnblock, unblockingId]
  );

  const listEmpty = useCallback(() => {
    if (blockedUsers === undefined) {
      return (
        <View style={[styles.blockedListCard, styles.blockedListEmpty]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.blockedListEmptyText}>Loading blocked users…</Text>
        </View>
      );
    }
    return (
      <View style={[styles.blockedListCard, styles.blockedListEmpty]}>
        <Text style={styles.blockedListEmptyText}>You have not blocked anyone.</Text>
      </View>
    );
  }, [blockedUsers]);

  if (isWeb) {
    return (
      <OpenInAppPrompt
        title="Open account settings in the mobile app"
        body="Notification preferences, blocked users, sign out, and account deletion are available in the PolyBuys mobile app."
        path="/account-settings"
        buttonLabel="Open in app"
        secondaryActionLabel="Back to home"
        onSecondaryAction={() => router.replace('/home')}
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

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      data={(blockedUsers ?? []) as BlockedRow[]}
      extraData={blockedListCount}
      keyExtractor={(item) => item.blockedId}
      renderItem={renderBlockedItem}
      ListHeaderComponent={
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.notificationRow}>
              <Text style={styles.notificationLabel}>Message notifications</Text>
              <Switch
                value={messageNotificationsValue}
                onValueChange={(value) => void handleMessageNotificationsToggle(value)}
                disabled={
                  isUpdatingMessageNotifications || messageNotificationsEnabled === undefined
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            <Text style={styles.notificationHint}>
              Get notified when someone messages you about a listing.
            </Text>
          </View>

          <View style={[styles.section, styles.blockedIntroSection]}>
            <Text style={styles.sectionTitle}>Blocked users</Text>
            <Text style={styles.notificationHint}>
              People you have blocked cannot message you. Unblock someone to allow conversations
              with them again.
            </Text>
          </View>
        </>
      }
      ListEmptyComponent={listEmpty}
      ListFooterComponent={
        <View style={styles.footerRow}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              styles.footerButtonHalf,
              pressed && styles.buttonPressed,
              (isSigningOut || isLoading) && styles.buttonDisabled,
            ]}
            onPress={() => void handleSignOut()}
            disabled={isSigningOut || isLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              styles.footerButtonHalf,
              pressed && styles.deleteButtonPressed,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleDeleteAccount}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Delete account permanently"
          >
            <Text style={styles.deleteButtonText}>Delete account</Text>
          </Pressable>
        </View>
      }
      keyboardShouldPersistTaps="handled"
    />
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
  listContent: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: 0,
    flexGrow: 1,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  blockedIntroSection: {
    marginBottom: spacing.sm,
  },
  blockedListCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textDark,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationLabel: {
    ...typography.body,
    color: colors.text,
  },
  notificationHint: {
    ...typography.footnote,
    color: colors.muted,
  },
  blockedListEmpty: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 88,
  },
  blockedListEmptyText: {
    ...typography.subhead,
    color: colors.muted,
    textAlign: 'center',
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  blockedRowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  blockedRowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  blockedRowWithSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  blockedRowText: {
    flex: 1,
    minWidth: 0,
  },
  blockedName: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textDark,
  },
  blockedMajor: {
    ...typography.footnote,
    color: colors.muted,
    marginTop: 2,
  },
  unblockButton: {
    minWidth: 96,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.18)',
    backgroundColor: 'rgba(21, 71, 52, 0.06)',
  },
  unblockButtonText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.primary,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    alignItems: 'stretch',
  },
  footerButtonHalf: {
    flex: 1,
    minWidth: 0,
  },
  deleteButton: {
    borderWidth: 2,
    borderColor: colors.destructive,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(179, 38, 30, 0.06)',
    boxShadow: '0 10px 20px rgba(179, 38, 30, 0.08)',
  },
  deleteButtonPressed: {
    opacity: 0.92,
    backgroundColor: 'rgba(179, 38, 30, 0.12)',
  },
  deleteButtonText: {
    ...typography.subhead,
    color: colors.destructive,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(21, 71, 52, 0.18)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    boxShadow: '0 8px 18px rgba(21, 71, 52, 0.08)',
  },
  secondaryButtonText: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
