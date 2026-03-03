import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { isAuthenticated } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const conversationId = id as Id<'conversations'> | undefined;

  const messages = useQuery(
    api.messages.messagesByConversation,
    conversationId ? { conversationId } : 'skip'
  );
  const currentUserSubject = useQuery(
    api.listings.getCurrentUserSubject,
    isAuthenticated ? {} : 'skip'
  );
  const sendMessage = useAction(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markMessagesAsRead);

  // Mark all messages read on mount and whenever new messages arrive
  useEffect(() => {
    if (conversationId && isAuthenticated) {
      markRead({ conversationId }).catch(() => {
        // fire-and-forget — not critical
      });
    }
  }, [conversationId, isAuthenticated, markRead, messages?.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !conversationId || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await sendMessage({ conversationId, body: text });
    } catch {
      setDraft(text); // restore on error
    } finally {
      setSending(false);
    }
  };

  if (!conversationId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Invalid conversation.</Text>
      </View>
    );
  }

  if (messages === undefined || currentUserSubject === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isOwn = item.senderId === currentUserSubject;
          const isSystem = item.type === 'system';
          if (isSystem) {
            return (
              <View style={styles.systemRow}>
                <Text style={styles.systemText}>{item.body}</Text>
              </View>
            );
          }
          return (
            <View style={[styles.bubbleRow, isOwn ? styles.ownRow : styles.otherRow]}>
              <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
                <Text style={[styles.bubbleText, isOwn ? styles.ownText : styles.otherText]}>
                  {item.body}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor="#999"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!sending}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#999',
    fontSize: 16,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubbleRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  ownRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: '#1976d2',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownText: {
    color: '#fff',
  },
  otherText: {
    color: '#333',
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#fafafa',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#1976d2',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendDisabled: {
    backgroundColor: '#b0bec5',
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
