import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import SafetyBanner from '../../components/SafetyBanner';
import { ScreenState } from '../../components/ScreenState';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

type ConversationId = Id<'conversations'>;

function formatMessageTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId =
    typeof id === 'string' && id.trim().length > 0 ? (id as ConversationId) : null;

  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const sendMessage = useAction(api.messages.sendMessage);
  const markMessagesAsRead = useMutation(api.messages.markMessagesAsRead);

  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const previousMessageCount = useRef(0);
  const isMarkingReadRef = useRef(false);

  const currentUserSubject = useQuery(
    api.listings.getCurrentUserSubject,
    isAuthenticated ? {} : 'skip'
  );
  const conversationList = useQuery(
    api.messages.listUserConversations,
    isAuthenticated ? {} : 'skip'
  );

  const conversation = useMemo(() => {
    if (!conversationId || !conversationList) {
      return null;
    }
    return conversationList.find((item) => item._id === conversationId) ?? null;
  }, [conversationId, conversationList]);
  const siblingConversationIds = useMemo(() => {
    if (!conversationId || !conversation) {
      return null;
    }

    const siblingIds = Array.isArray(conversation.siblingConversationIds)
      ? conversation.siblingConversationIds.filter(
          (value): value is ConversationId => typeof value === 'string' && value.length > 0
        )
      : [];

    return [...new Set([conversationId, ...siblingIds])] as ConversationId[];
  }, [conversation, conversationId]);

  const listingId = (conversation?.listing?.id ??
    conversation?.listingId ??
    null) as Id<'listings'> | null;
  const listing = useQuery(api.listings.getListing, listingId ? { id: listingId } : 'skip');
  const headerThumbnailSource =
    conversation?.listing?.thumbnailUrl ??
    (listing?.images && listing.images.length > 0 ? listing.images[0] : null);
  const { mappedUrls: headerMappedUrls } = useResolvedImageUrls(
    headerThumbnailSource ? [headerThumbnailSource] : []
  );
  const headerThumbnailUrl = headerMappedUrls[0] ?? null;
  const headerOtherUserName = conversation?.otherUser?.name ?? 'User';
  const headerConversationTitle = conversation?.otherUser?.name ?? 'Conversation';
  const headerListingTitle =
    conversation?.listing?.title ?? listing?.title ?? 'Listing unavailable';

  const messages = useQuery(
    api.messages.messagesByConversation,
    isAuthenticated && conversationId && conversation
      ? {
          conversationId,
          siblingConversationIds:
            siblingConversationIds && siblingConversationIds.length > 1
              ? siblingConversationIds
              : undefined,
        }
      : 'skip'
  );
  const currentUserId = currentUserSubject ?? user?._id ?? null;
  const unreadIncomingCount =
    messages?.filter(
      (message) =>
        message.readAt === 0 && currentUserId !== null && message.recipientId === currentUserId
    ).length ?? 0;

  const scrollToBottom = (animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const returnTo = conversationId ? `/conversations/${conversationId}` : '/inbox';
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}` as never);
    }
  }, [authLoading, conversationId, isAuthenticated, router]);

  useEffect(() => {
    if (!messages) {
      return;
    }

    if (messages.length > 0 && previousMessageCount.current === 0) {
      scrollToBottom(false);
    } else if (messages.length > previousMessageCount.current) {
      scrollToBottom(true);
    }

    previousMessageCount.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (
      !conversationId ||
      !isAuthenticated ||
      unreadIncomingCount === 0 ||
      !siblingConversationIds
    ) {
      return;
    }

    if (isMarkingReadRef.current) {
      return;
    }
    isMarkingReadRef.current = true;

    void markMessagesAsRead({
      conversationId,
      siblingConversationIds:
        siblingConversationIds.length > 1 ? siblingConversationIds : undefined,
    })
      .catch(() => {
        // Non-fatal: message stream still renders in real time.
      })
      .finally(() => {
        isMarkingReadRef.current = false;
      });
  }, [
    conversationId,
    isAuthenticated,
    markMessagesAsRead,
    siblingConversationIds,
    unreadIncomingCount,
  ]);

  const onSend = async () => {
    const trimmed = messageBody.trim();
    if (!trimmed || !conversationId || isSending) {
      return;
    }

    try {
      setIsSending(true);
      await sendMessage({ conversationId, body: trimmed });
      setMessageBody('');
      scrollToBottom(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send message right now.';
      Alert.alert('Message failed', message);
    } finally {
      setIsSending(false);
    }
  };

  if (!conversationId) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Conversation not found</Text>
      </View>
    );
  }

  if (
    authLoading ||
    (isAuthenticated &&
      (conversationList === undefined ||
        currentUserSubject === undefined ||
        (conversation !== null && messages === undefined)))
  ) {
    return (
      <View style={styles.centeredState}>
        <ScreenState variant="loading" title="Loading conversation..." />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.centeredState}>
        <ScreenState variant="loading" title="Redirecting to login..." />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View style={styles.centeredState}>
        <ScreenState
          variant="empty"
          title="Conversation unavailable"
          message="This conversation was not found or you no longer have access."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 82 : 0}
    >
      <Stack.Screen
        options={{
          title: headerConversationTitle,
          headerBackTitle: 'Inbox',
        }}
      />

      <View style={styles.headerCard}>
        {headerThumbnailUrl ? (
          <Image source={{ uri: headerThumbnailUrl }} style={styles.headerThumbnail} />
        ) : (
          <View style={[styles.headerThumbnail, styles.thumbnailPlaceholder]}>
            <Text style={styles.thumbnailPlaceholderText}>No image</Text>
          </View>
        )}
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerName} numberOfLines={1}>
            {headerOtherUserName}
          </Text>
          <Text style={styles.headerListing} numberOfLines={1}>
            {headerListingTitle}
          </Text>
        </View>
        {listingId ? (
          <Pressable
            onPress={() => router.push(`/listings/${listingId}`)}
            style={({ pressed }) => [styles.headerListingLink, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="View listing"
          >
            <Text style={styles.headerListingLinkText}>View listing</Text>
          </Pressable>
        ) : null}
      </View>

      <SafetyBanner />

      <FlatList
        ref={listRef}
        data={messages ?? []}
        keyExtractor={(item) => item._id}
        style={styles.messagesList}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isSent = currentUserId !== null && item.senderId === currentUserId;
          const receiptLabel = item.readAt > 0 ? 'Read' : 'Sent';
          return (
            <View
              style={[
                styles.messageRow,
                isSent ? styles.messageRowSent : styles.messageRowReceived,
              ]}
            >
              <View style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
                <Text
                  style={[
                    styles.messageText,
                    isSent ? styles.messageTextSent : styles.messageTextReceived,
                  ]}
                >
                  {item.body}
                </Text>
                <Text
                  style={[
                    styles.messageMeta,
                    isSent ? styles.messageMetaSent : styles.messageMetaReceived,
                  ]}
                >
                  {isSent
                    ? `${formatMessageTimestamp(item.createdAt)} • ${receiptLabel}`
                    : formatMessageTimestamp(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No messages yet. Say hello.</Text>
          </View>
        }
      />

      <View style={styles.composerWrap}>
        <TextInput
          value={messageBody}
          onChangeText={setMessageBody}
          placeholder="Type a message..."
          style={styles.input}
          multiline
          maxLength={2000}
          editable={!isSending}
          textAlignVertical="top"
        />
        <Pressable
          onPress={() => {
            void onSend();
          }}
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
    backgroundColor: colors.background,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  stateTitle: {
    ...typography.title1,
    color: colors.textDark,
  },
  headerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  headerThumbnail: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    ...typography.footnote,
    fontSize: 10,
    color: colors.muted,
    fontWeight: '600',
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerName: {
    ...typography.heading,
    color: colors.textDark,
  },
  headerListing: {
    ...typography.footnoteMed,
    color: colors.text,
  },
  headerListingLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.location,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  headerListingLinkText: {
    color: colors.primary,
    ...typography.footnote,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 6,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowSent: {
    justifyContent: 'flex-end',
  },
  messageRowReceived: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  bubbleSent: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.subhead,
  },
  messageTextSent: {
    color: colors.white,
  },
  messageTextReceived: {
    color: colors.textDark,
  },
  messageMeta: {
    ...typography.footnote,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  messageMetaSent: {
    color: colors.border,
  },
  messageMetaReceived: {
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyStateText: {
    ...typography.subhead,
    color: colors.text,
  },
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    ...typography.subhead,
    color: colors.textDark,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
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
