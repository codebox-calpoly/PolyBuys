import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
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
import { borderRadius, colors, spacing, typography } from '../theme/tokens';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const signOutInProgressRef = useRef(false);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [messageNotificationsValue, setMessageNotificationsValue] = useState(true);
  const [isUpdatingMessageNotifications, setIsUpdatingMessageNotifications] = useState(false);

  const messageNotificationsEnabled = useQuery(
    api.users.getMessageNotificationsEnabled,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const updateMessageNotificationsEnabled = useMutation(
    api.users.updateMessageNotificationsEnabled
  );
  const recordPushToken = useMutation(api.pushNotifications.recordPushToken);
  const removePushToken = useMutation(api.pushNotifications.removePushToken);
  const deleteAccount = useMutation(api.users.deleteAccount);

  useEffect(() => {
    if (!isWeb && !isLoading && !isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Faccount-settings' as never);
    }
  }, [isAuthenticated, isLoading, isWeb, router]);

  useEffect(() => {
    if (typeof messageNotificationsEnabled === 'boolean') {
      setMessageNotificationsValue(messageNotificationsEnabled);
    }
  }, [messageNotificationsEnabled]);

  const handleSignOut = async () => {
    if (!isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Faccount-settings' as never);
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
      const message = error instanceof Error ? error.message : 'Failed to sign out';
      Alert.alert('Sign Out Failed', message);
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
              const message = error instanceof Error ? error.message : 'Failed to delete account';
              Alert.alert('Delete Account Failed', message);
              return;
            }

            try {
              await signOut();
            } catch (error) {
              const details = error instanceof Error ? `\n\nDetails: ${error.message}` : '';
              Alert.alert(
                'Account Deleted',
                `Your account was deleted, but we could not sign you out automatically. Please sign out manually.${details}`
              );
            }
          },
        },
      ]
    );
  };

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
          const message =
            error instanceof Error ? error.message : 'Unable to enable notifications right now.';
          Alert.alert('Notification Update Failed', message);
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

        await updateMessageNotificationsEnabled({ enabled: true });
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
        } catch (error) {
          const updatePreferenceMessage =
            error instanceof Error ? error.message : 'Failed to update notification preference';

          if (removePushTokenSucceeded) {
            Alert.alert(
              'Notification partially updated',
              `This device push token was removed, but we could not save your notification preference.\n\nDetails: ${updatePreferenceMessage}`
            );
            return;
          }

          setMessageNotificationsValue(previousValue);
          const removeTokenMessage =
            removePushTokenError instanceof Error
              ? removePushTokenError.message
              : 'Failed to remove this device push token.';

          Alert.alert(
            'Notification Update Failed',
            `We could not disable notifications.\n\nToken removal: ${removeTokenMessage}\nPreference update: ${updatePreferenceMessage}`
          );
          return;
        }
      }
    } catch (error) {
      setMessageNotificationsValue(previousValue);
      const message =
        error instanceof Error ? error.message : 'Failed to update notification preference';
      Alert.alert('Notification Update Failed', message);
    } finally {
      setIsUpdatingMessageNotifications(false);
    }
  };

  if (isWeb) {
    return (
      <OpenInAppPrompt
        title="Open account settings in the mobile app"
        body="Notification preferences, sign out, and account deletion are available in the PolyBuys mobile app."
        path="/account-settings"
        buttonLabel="Open in app"
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

  return (
    <ScrollView
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.notificationRow}>
          <Text style={styles.notificationLabel}>Message notifications</Text>
          <Switch
            value={messageNotificationsValue}
            onValueChange={(value) => void handleMessageNotificationsToggle(value)}
            disabled={isUpdatingMessageNotifications || messageNotificationsEnabled === undefined}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.notificationHint}>
          Get notified when someone messages you about a listing.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
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
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
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
  footer: {
    marginTop: spacing.md,
    gap: spacing.md,
    alignSelf: 'flex-start',
    alignItems: 'stretch',
  },
  deleteButton: {
    borderWidth: 2,
    borderColor: colors.destructive,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(179, 38, 30, 0.06)',
  },
  deleteButtonPressed: {
    opacity: 0.92,
    backgroundColor: 'rgba(179, 38, 30, 0.12)',
  },
  deleteButtonText: {
    ...typography.subhead,
    color: colors.destructive,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
