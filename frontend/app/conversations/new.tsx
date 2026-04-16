import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAction, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import ProfileAvatar from '../../components/ProfileAvatar';
import { ScreenState } from '../../components/ScreenState';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export default function NewConversationScreen() {
  const { listingId: rawListingId } = useLocalSearchParams<{ listingId?: string }>();
  const listingId =
    typeof rawListingId === 'string' && rawListingId.trim().length > 0
      ? (rawListingId as Id<'listings'>)
      : null;

  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { isAuthenticated, isSessionLoading } = useAuth();
  const createConversationAndSendFirstMessage = useAction(
    api.messages.createConversationAndSendFirstMessage
  );

  const listing = useQuery(api.listings.getListing, listingId ? { id: listingId } : 'skip');
  const sellerProfile = useQuery(
    api.profiles.getProfileByUserId,
    listing?.sellerId ? { userId: listing.sellerId } : 'skip'
  );
  const { mappedUrls: sellerAvatarUrls } = useResolvedImageUrls(
    sellerProfile?.picture ? [sellerProfile.picture] : []
  );
  const sellerAvatarUrl = sellerAvatarUrls[0] ?? null;

  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const onSend = async () => {
    const trimmed = messageBody.trim();
    if (!trimmed || !listingId || isSending) return;

    try {
      setIsSending(true);
      const { conversationId } = await createConversationAndSendFirstMessage({
        listingId,
        body: trimmed,
      });
      router.replace({
        pathname: '/conversations/[id]',
        params: { id: String(conversationId) },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send message right now.';
      Alert.alert('Message failed', message);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      const returnTo = listingId ? `/conversations/new?listingId=${listingId}` : '/inbox';
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}` as Href);
    }
  }, [isSessionLoading, isAuthenticated, listingId, router]);

  if (!listingId) {
    return (
      <View style={styles.centered}>
        <ScreenState variant="error" title="No listing selected" onRetry={() => router.back()} />
      </View>
    );
  }

  if (isSessionLoading || !isAuthenticated) {
    return (
      <View style={styles.centered}>
        <ScreenState variant="loading" title="Redirecting to login..." />
      </View>
    );
  }

  if (listing === undefined) {
    return (
      <View style={styles.centered}>
        <ScreenState variant="loading" title="Loading listing..." />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.centered}>
        <ScreenState variant="empty" title="Listing not found" onRetry={() => router.back()} />
      </View>
    );
  }

  const sellerName = sellerProfile?.name ?? 'Seller';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <Stack.Screen
        options={{
          title: `Message ${sellerName}`,
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.content}>
        <View style={styles.sellerRow}>
          <ProfileAvatar uri={sellerAvatarUrl} name={sellerName} size={48} />
          <View style={styles.sellerCopy}>
            <Text style={styles.sellerName}>{sellerName}</Text>
            <Text style={styles.sellerListing} numberOfLines={1}>
              {listing.title}
            </Text>
          </View>
        </View>
        <Text style={styles.prompt}>Send a message about &quot;{listing.title}&quot;</Text>
        <TextInput
          value={messageBody}
          onChangeText={setMessageBody}
          placeholder="Type your message..."
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          style={styles.input}
          multiline
          maxLength={2000}
          editable={!isSending}
          textAlignVertical="top"
        />
        <Pressable
          onPress={() => void onSend()}
          style={({ pressed }) => [
            styles.sendButton,
            (!messageBody.trim() || isSending) && styles.sendButtonDisabled,
            pressed && styles.buttonPressed,
          ]}
          disabled={!messageBody.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>{isSending ? 'Sending...' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  sellerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  sellerName: {
    ...typography.subhead,
    color: colors.textDark,
    fontWeight: '700',
  },
  sellerListing: {
    ...typography.footnote,
    color: colors.text,
  },
  prompt: {
    ...typography.subhead,
    color: colors.text,
  },
  input: {
    flex: 1,
    minHeight: 120,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.subhead,
    color: colors.textDark,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: colors.white,
    ...typography.subhead,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
