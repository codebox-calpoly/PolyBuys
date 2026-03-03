import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { normalizeConvexId } from '../../utils/convexId';

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = normalizeConvexId(id);
  const { isAuthenticated, isLoading } = useAuth();
  const convex = useConvex();
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [olderMessages, setOlderMessages] = useState<Array<Doc<'messages'>>>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const latestPage = useQuery(
    api.messages.messagesByConversationPaginated,
    isAuthenticated && conversationId
      ? { conversationId: conversationId as Id<'conversations'> }
      : 'skip'
  );
  const currentUserSubject = useQuery(
    api.listings.getCurrentUserSubject,
    isAuthenticated ? {} : 'skip'
  );
  const markMessagesAsRead = useMutation(api.messages.markMessagesAsRead);
  const sendMessage = useAction(api.messages.sendMessage);

  useEffect(() => {
    setOlderMessages([]);
    setOlderCursor(null);
  }, [conversationId]);

  useEffect(() => {
    if (!latestPage || olderMessages.length > 0 || olderCursor !== null) {
      return;
    }
    setOlderCursor(latestPage.nextCursor);
  }, [latestPage, olderCursor, olderMessages.length]);

  const combinedMessages = useMemo(() => {
    const map = new Map<string, Doc<'messages'>>();
    const all = [...olderMessages, ...(latestPage?.items ?? [])];
    for (const message of all) {
      map.set(String(message._id), message);
    }
    return [...map.values()].sort((a, b) => {
      const createdDiff = Number(a.createdAt) - Number(b.createdAt);
      if (createdDiff !== 0) {
        return createdDiff;
      }
      return String(a._id).localeCompare(String(b._id));
    });
  }, [latestPage?.items, olderMessages]);

  useEffect(() => {
    if (!isAuthenticated || !conversationId || combinedMessages.length === 0) {
      return;
    }

    void markMessagesAsRead({ conversationId: conversationId as Id<'conversations'> }).catch(() => {
      // Non-blocking; unread state will reconcile on next successful refresh.
    });
  }, [combinedMessages.length, conversationId, isAuthenticated, markMessagesAsRead]);

  const hasValidConversation = conversationId !== null;
  const isQueryLoading =
    isLoading ||
    (isAuthenticated &&
      hasValidConversation &&
      (latestPage === undefined || currentUserSubject === undefined));

  async function handleLoadOlder() {
    if (!conversationId || !olderCursor || isLoadingOlder) {
      return;
    }
    try {
      setIsLoadingOlder(true);
      const olderPage = await convex.query(api.messages.messagesByConversationPaginated, {
        conversationId: conversationId as Id<'conversations'>,
        cursor: olderCursor,
      });
      setOlderMessages((prev) => [...olderPage.items, ...prev]);
      setOlderCursor(olderPage.nextCursor);
    } catch {
      Alert.alert('Unable to load older messages right now.');
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function handleSend() {
    if (!conversationId || isSending) {
      return;
    }

    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }

    try {
      setIsSending(true);
      await sendMessage({
        conversationId: conversationId as Id<'conversations'>,
        body: trimmed,
      });
      setDraft('');
      await markMessagesAsRead({ conversationId: conversationId as Id<'conversations'> });
    } catch {
      Alert.alert('Unable to send message right now.');
    } finally {
      setIsSending(false);
    }
  }

  if (!hasValidConversation) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.title}>Conversation unavailable</Text>
        <Text style={styles.subtitle}>This conversation link is invalid.</Text>
      </View>
    );
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.title}>Sign in required</Text>
        <Text style={styles.subtitle}>You need to sign in to view this conversation.</Text>
      </View>
    );
  }

  if (isQueryLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.subtitle}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={combinedMessages}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.messagesList}
        ListHeaderComponent={
          olderCursor ? (
            <Pressable
              style={({ pressed }) => [
                styles.loadOlderButton,
                isLoadingOlder && styles.sendButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                void handleLoadOlder();
              }}
              disabled={isLoadingOlder}
            >
              <Text style={styles.loadOlderText}>
                {isLoadingOlder ? 'Loading...' : 'Load older messages'}
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyBody}>Send the first message to start the conversation.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = currentUserSubject === item.senderId;
          const isSystem = item.type === 'system';

          if (isSystem) {
            return (
              <View style={styles.systemMessageWrap}>
                <Text style={styles.systemMessageText}>{item.body}</Text>
              </View>
            );
          }

          return (
            <View
              style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}
            >
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
                  {item.body}
                </Text>
                <Text style={[styles.timestamp, isMine && styles.timestampMine]}>
                  {formatTimestamp(Number(item.createdAt))}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message..."
          editable={!isSending}
          maxLength={2000}
          multiline
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            (isSending || draft.trim().length === 0) && styles.sendButtonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => {
            void handleSend();
          }}
          disabled={isSending || draft.trim().length === 0}
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
    paddingHorizontal: 20,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#14362a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#5d6f68',
    textAlign: 'center',
  },
  messagesList: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  loadOlderButton: {
    alignSelf: 'center',
    backgroundColor: '#edf5f1',
    borderWidth: 1,
    borderColor: '#d1e2d9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  loadOlderText: {
    color: '#1f5140',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dde8e2',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15382b',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#5d6f68',
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
  },
  bubbleMine: {
    backgroundColor: '#154734',
    borderColor: '#154734',
  },
  bubbleOther: {
    backgroundColor: '#ffffff',
    borderColor: '#d7e4de',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#173329',
  },
  messageTextMine: {
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 11,
    color: '#6c7f76',
    textAlign: 'right',
  },
  timestampMine: {
    color: '#d5e8df',
  },
  systemMessageWrap: {
    alignItems: 'center',
    marginVertical: 6,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#5f6f68',
    backgroundColor: '#e9f0ec',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: '#dbe5e0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d5e1db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 140,
    backgroundColor: '#f8fbf9',
  },
  sendButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#154734',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});
