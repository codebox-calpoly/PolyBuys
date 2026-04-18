import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Doc, Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import ProfileAvatar from '../../components/ProfileAvatar';
import { ReportModal } from '../../components/ReportModal';
import SafetyBanner from '../../components/SafetyBanner';
import { ScreenState } from '../../components/ScreenState';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

type ConversationId = Id<'conversations'>;
const MESSAGE_ACTION_PANEL_WIDTH = 74;
const MESSAGE_ACTION_BUTTON_WIDTH = MESSAGE_ACTION_PANEL_WIDTH;
const MESSAGE_ACTION_BUTTON_HEIGHT = 44;

function formatMessageTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function SwipeableMessageRow({
  message,
  isSent,
  receiptLabel,
  activeMessageActionId,
  setActiveMessageActionId,
  onDelete,
  onReport,
}: {
  message: Doc<'messages'>;
  isSent: boolean;
  receiptLabel: string;
  activeMessageActionId: Id<'messages'> | null;
  setActiveMessageActionId: (messageId: Id<'messages'> | null) => void;
  onDelete: (messageId: Id<'messages'>) => void;
  onReport: (messageId: Id<'messages'>) => void;
}) {
  const isActionOpen = activeMessageActionId === message._id;

  const handleDeletePress = useCallback(() => {
    setActiveMessageActionId(null);
    onDelete(message._id);
  }, [message._id, onDelete, setActiveMessageActionId]);

  const handleReportPress = useCallback(() => {
    setActiveMessageActionId(null);
    onReport(message._id);
  }, [message._id, onReport, setActiveMessageActionId]);

  const handleMessagePress = useCallback(() => {
    if (isActionOpen) {
      setActiveMessageActionId(null);
    }
  }, [isActionOpen, setActiveMessageActionId]);

  const handleMessageLongPress = useCallback(() => {
    setActiveMessageActionId(message._id);
  }, [message._id, setActiveMessageActionId]);

  return (
    <View style={[styles.messageRow, isSent ? styles.messageRowSent : styles.messageRowReceived]}>
      <Pressable
        onPress={handleMessagePress}
        onLongPress={handleMessageLongPress}
        delayLongPress={260}
        style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}
        accessibilityRole="button"
        accessibilityLabel={isSent ? 'Sent message' : 'Received message'}
        accessibilityHint={
          isSent ? 'Long press to show delete action' : 'Long press to show report action'
        }
      >
        <Text
          style={[styles.messageText, isSent ? styles.messageTextSent : styles.messageTextReceived]}
        >
          {message.body}
        </Text>
        <Text
          style={[styles.messageMeta, isSent ? styles.messageMetaSent : styles.messageMetaReceived]}
        >
          {isSent
            ? `${formatMessageTimestamp(message.createdAt)} • ${receiptLabel}`
            : formatMessageTimestamp(message.createdAt)}
        </Text>
      </Pressable>
      {isActionOpen ? (
        <View style={styles.messageActionPanel}>
          {isSent ? (
            <Pressable
              style={[styles.messageActionButton, styles.messageDeleteActionButton]}
              onPress={handleDeletePress}
              accessibilityRole="button"
              accessibilityLabel="Delete message"
            >
              <Text style={styles.messageActionLabel}>Delete</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.messageActionButton, styles.messageReportActionButton]}
              onPress={handleReportPress}
              accessibilityRole="button"
              accessibilityLabel="Report message"
            >
              <Text style={styles.messageActionLabel}>Report</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId =
    typeof id === 'string' && id.trim().length > 0 ? (id as ConversationId) : null;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, isAuthenticated, isSessionLoading } = useAuth();
  const sendMessage = useAction(api.messages.sendMessage);
  const markMessagesAsRead = useMutation(api.messages.markMessagesAsRead);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const blockUser = useMutation(api.blocks.blockUser);
  const unblockUser = useMutation(api.blocks.unblockUser);

  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [reportingMessageId, setReportingMessageId] = useState<Id<'messages'> | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<Id<'messages'> | null>(null);
  const [activeMessageActionId, setActiveMessageActionId] = useState<Id<'messages'> | null>(null);
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

  const otherUserId = conversation?.canonicalOtherUserId ?? null;
  const isBlockingOther = useQuery(
    api.blocks.isBlocking,
    isAuthenticated && otherUserId ? { blockedId: otherUserId } : 'skip'
  );
  const isBlockedByOther = useQuery(
    api.blocks.isBlockedBy,
    isAuthenticated && otherUserId ? { blockerId: otherUserId } : 'skip'
  );
  const isBlockStatusLoading =
    isAuthenticated &&
    otherUserId !== null &&
    (isBlockingOther === undefined || isBlockedByOther === undefined);

  const listingId = (conversation?.listing?.id ??
    conversation?.listingId ??
    null) as Id<'listings'> | null;
  const listing = useQuery(api.listings.getListing, listingId ? { id: listingId } : 'skip');
  const headerOtherUserPicture = conversation?.otherUser?.picture ?? null;
  const { mappedUrls: headerAvatarMappedUrls } = useResolvedImageUrls(
    headerOtherUserPicture ? [headerOtherUserPicture] : []
  );
  const headerAvatarUrl = headerAvatarMappedUrls[0] ?? null;
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
    if (!isSessionLoading && !isAuthenticated) {
      const returnTo = conversationId ? `/conversations/${conversationId}` : '/inbox';
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}` as never);
    }
  }, [isSessionLoading, conversationId, isAuthenticated, router]);

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

  const handleBlockPress = () => {
    if (!otherUserId) return;

    if (isBlockingOther === true) {
      unblockUser({ blockedId: otherUserId }).catch((err) => {
        Alert.alert('Could not unblock', err instanceof Error ? err.message : 'Please try again.');
      });
      return;
    }

    const blockAction = async () => {
      try {
        const blockId = await blockUser({ blockedId: otherUserId });
        if (!blockId) {
          Alert.alert('User unavailable', 'This user is no longer available to block.');
          return;
        }

        Alert.alert('User blocked', 'You will no longer receive messages from this user.');
      } catch (err) {
        Alert.alert('Could not block', err instanceof Error ? err.message : 'Please try again.');
      }
    };

    Alert.alert(
      'Block user',
      'You will no longer receive messages from this user. They will not be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void blockAction() },
      ]
    );
  };

  const onSend = async () => {
    const trimmed = messageBody.trim();
    if (
      !trimmed ||
      !conversationId ||
      isSending ||
      isBlockStatusLoading ||
      isBlockingOther === true ||
      isBlockedByOther === true
    ) {
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

  const handleDeleteMessage = async (messageId: Id<'messages'>) => {
    if (deletingMessageId === messageId) {
      return;
    }

    try {
      setDeletingMessageId(messageId);
      await deleteMessage({ messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete this message.';
      Alert.alert('Could not delete message', message);
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleBackgroundPress = useCallback(() => {
    setActiveMessageActionId(null);
    Keyboard.dismiss();
  }, []);

  if (!conversationId) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Conversation not found</Text>
      </View>
    );
  }

  if (
    isSessionLoading ||
    (isAuthenticated &&
      (conversationList === undefined ||
        currentUserSubject === undefined ||
        (conversation !== null && messages === undefined) ||
        isBlockStatusLoading))
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
    <TouchableWithoutFeedback onPress={handleBackgroundPress} accessible={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <Stack.Screen
          options={{
            title: headerConversationTitle,
            headerBackTitle: 'Inbox',
            headerRight: otherUserId
              ? () => (
                  <Pressable
                    onPress={handleBlockPress}
                    style={({ pressed }) => [styles.headerAction, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.headerActionText}>
                      {isBlockingOther === true ? 'Unblock' : 'Block'}
                    </Text>
                  </Pressable>
                )
              : undefined,
          }}
        />

        <View style={styles.headerCard}>
          <ProfileAvatar uri={headerAvatarUrl} name={headerOtherUserName} size={64} />
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
          scrollEnabled={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            setActiveMessageActionId(null);
          }}
          renderItem={({ item }) => {
            const isSent = currentUserId !== null && item.senderId === currentUserId;
            const receiptLabel = item.readAt > 0 ? 'Read' : 'Sent';
            return (
              <SwipeableMessageRow
                message={item}
                isSent={isSent}
                receiptLabel={receiptLabel}
                activeMessageActionId={activeMessageActionId}
                setActiveMessageActionId={setActiveMessageActionId}
                onDelete={(messageId) => {
                  Alert.alert('Delete message', 'Remove this message from the conversation?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        void handleDeleteMessage(messageId);
                      },
                    },
                  ]);
                }}
                onReport={(messageId) => {
                  Alert.alert(
                    'Report message',
                    'This will submit a report and hide this conversation from your inbox.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Report',
                        style: 'destructive',
                        onPress: () => setReportingMessageId(messageId),
                      },
                    ]
                  );
                }}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No messages yet. Say hello.</Text>
            </View>
          }
        />

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          {isBlockingOther === true ? (
            <View style={styles.blockedComposer}>
              <Text style={styles.blockedText}>
                You have blocked this user. Tap Unblock above to send messages.
              </Text>
            </View>
          ) : isBlockedByOther === true ? (
            <View style={styles.blockedComposer}>
              <Text style={styles.blockedText}>
                You cannot send messages in this conversation because this user has blocked you.
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                value={messageBody}
                onChangeText={setMessageBody}
                placeholder="Type a message..."
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
            </>
          )}
        </View>
        <ReportModal
          isVisible={reportingMessageId !== null}
          onClose={() => setReportingMessageId(null)}
          targetId={reportingMessageId ? String(reportingMessageId) : ''}
          targetType="message"
          onReportSuccess={() => {
            setActiveMessageActionId(null);
            router.replace('/inbox' as never);
          }}
        />
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
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
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '92%',
    gap: 0,
  },
  messageRowSent: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
    maxWidth: '82%',
  },
  messageRowReceived: {
    alignSelf: 'flex-start',
  },
  messageActionPanel: {
    width: MESSAGE_ACTION_PANEL_WIDTH,
    height: MESSAGE_ACTION_BUTTON_HEIGHT,
    flexDirection: 'row',
    marginLeft: 0,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  messageActionButton: {
    width: MESSAGE_ACTION_BUTTON_WIDTH,
    height: MESSAGE_ACTION_BUTTON_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageReportActionButton: {
    backgroundColor: colors.destructive,
  },
  messageDeleteActionButton: {
    backgroundColor: '#c62828',
  },
  messageActionLabel: {
    ...typography.footnoteMed,
    fontSize: 8,
    fontWeight: '700',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  bubble: {
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
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
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
  headerAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerActionText: {
    ...typography.subhead,
    color: colors.destructive,
    fontWeight: '600',
  },
  blockedComposer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  blockedText: {
    ...typography.footnote,
    color: colors.muted,
    textAlign: 'center',
  },
});
