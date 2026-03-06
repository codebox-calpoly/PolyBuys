import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const sendMessage = useAction(api.messages.sendMessage);
  const markMessagesAsRead = useMutation(api.messages.markMessagesAsRead);

  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const previousMessageCount = useRef(0);

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

  const messages = useQuery(
    api.messages.messagesByConversation,
    isAuthenticated && conversationId && conversation ? { conversationId } : 'skip'
  );

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
    if (!conversationId || !conversation?.hasUnread) {
      return;
    }

    void markMessagesAsRead({ conversationId }).catch(() => {
      // Non-fatal: message stream still renders in real time.
    });
  }, [conversation?.hasUnread, conversationId, markMessagesAsRead]);

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
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.stateText}>Loading conversation...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.stateText}>Redirecting to login...</Text>
      </View>
    );
  }

  if (!conversation) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Conversation unavailable</Text>
        <Text style={styles.stateText}>
          This conversation was not found or you no longer have access.
        </Text>
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
          title: conversation?.otherUser.name ?? 'Conversation',
          headerBackTitle: 'Inbox',
        }}
      />

      <View style={styles.headerCard}>
        {conversation?.listing.thumbnailUrl ? (
          <Image
            source={{ uri: conversation.listing.thumbnailUrl }}
            style={styles.headerThumbnail}
          />
        ) : (
          <View style={[styles.headerThumbnail, styles.thumbnailPlaceholder]}>
            <Text style={styles.thumbnailPlaceholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerName} numberOfLines={1}>
            {conversation?.otherUser.name ?? 'User'}
          </Text>
          <Text style={styles.headerListing} numberOfLines={1}>
            {conversation?.listing.title ?? 'Listing unavailable'}
          </Text>
          {conversation?.listing.id ? (
            <Pressable
              onPress={() => router.push(`/listings/${conversation.listing.id}`)}
              style={({ pressed }) => [styles.headerListingLink, pressed && styles.buttonPressed]}
            >
              <Text style={styles.headerListingLinkText}>View listing</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages ?? []}
        keyExtractor={(item) => item._id}
        style={styles.messagesList}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isSent = item.senderId === currentUserSubject;
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
                  {formatMessageTimestamp(item.createdAt)}
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
    backgroundColor: '#f3f7f5',
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f3f7f5',
    paddingHorizontal: 20,
  },
  stateTitle: {
    color: '#0f2b21',
    fontSize: 20,
    fontWeight: '700',
  },
  stateText: {
    color: '#5a6f65',
    fontSize: 15,
  },
  headerCard: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#fff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerThumbnail: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#edf2ef',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    color: '#7d8f85',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f2b21',
  },
  headerListing: {
    fontSize: 13,
    color: '#4f645b',
    fontWeight: '500',
  },
  headerListingLink: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#d5e4ff',
  },
  headerListingLinkText: {
    color: '#2f5fbd',
    fontSize: 12,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
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
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 4,
  },
  bubbleSent: {
    backgroundColor: '#154734',
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8e6df',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextSent: {
    color: '#ffffff',
  },
  messageTextReceived: {
    color: '#173429',
  },
  messageMeta: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  messageMetaSent: {
    color: '#d4e6df',
  },
  messageMetaReceived: {
    color: '#6e8278',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    color: '#5f7268',
    fontSize: 15,
  },
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: '#d8e6df',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d6e3dd',
    backgroundColor: '#f8fbf9',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: '#173429',
  },
  sendButton: {
    backgroundColor: '#154734',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
