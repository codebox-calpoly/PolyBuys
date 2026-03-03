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
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from '../../../backend/convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MessageThreadPlaceholderScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = typeof id === 'string' && id.trim().length > 0 ? id : null;
  const { isAuthenticated, isLoading } = useAuth();
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messages = useQuery(
    api.messages.messagesByConversation,
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
    if (!isAuthenticated || !conversationId || !messages) {
      return;
    }

    void markMessagesAsRead({ conversationId: conversationId as Id<'conversations'> }).catch(() => {
      // Non-blocking; unread state will reconcile on next successful refresh.
    });
  }, [conversationId, isAuthenticated, markMessagesAsRead, messages]);

  const hasValidConversation = conversationId !== null;
  const isQueryLoading =
    isLoading ||
    (isAuthenticated &&
      hasValidConversation &&
      (messages === undefined || currentUserSubject === undefined));
  const sortedMessages = useMemo(() => messages ?? [], [messages]);

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
        data={sortedMessages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messagesList}
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
                  {formatTimestamp(item.createdAt)}
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
