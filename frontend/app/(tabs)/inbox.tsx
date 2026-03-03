import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from 'convex/_generated/api';
import { useAuth } from '../../hooks/useAuth';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function InboxScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const conversations = useQuery(
    api.messages.listUserConversations,
    isAuthenticated ? { limit: 30 } : 'skip'
  );

  if (!isAuthenticated && !isLoading) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.emptyTitle}>Sign in required</Text>
        <Text style={styles.emptyBody}>Sign in to view your conversations.</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={() => router.push('/auth/login?returnTo=%2Finbox' as never)}
        >
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading || (isAuthenticated && conversations === undefined)) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  const items = conversations?.items ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.conversationId)}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <Animated.View style={[styles.card, entranceStyle]}>
          <Text style={styles.eyebrow}>Inbox</Text>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.body}>Chat with buyers and sellers about listings.</Text>
        </Animated.View>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyBody}>Start by messaging a seller from a listing.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.conversationRow, pressed && styles.buttonPressed]}
          onPress={() =>
            router.push({
              pathname: '/messages/[id]',
              params: { id: String(item.conversationId) },
            })
          }
        >
          <View style={styles.rowTop}>
            <Text style={styles.otherName} numberOfLines={1}>
              {item.otherParticipant.name?.trim() || 'PolyBuys user'}
            </Text>
            <Text style={styles.timestamp}>{formatTimestamp(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={styles.previewText} numberOfLines={1}>
              {item.lastMessagePreview || 'No messages yet'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadText}>
                  {item.unreadCapped ? `${item.unreadCount}+` : String(item.unreadCount)}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#f3f7f5',
  },
  loadingText: {
    color: '#5f7268',
    fontSize: 15,
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 26,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 12,
    color: '#2a6f52',
    letterSpacing: 0.4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f2b21',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5a6f65',
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dde8e2',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#163429',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#5e7268',
    textAlign: 'center',
  },
  conversationRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dde8e2',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  otherName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#123428',
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7e75',
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    color: '#546760',
  },
  unreadPill: {
    minWidth: 24,
    borderRadius: 999,
    backgroundColor: '#154734',
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  unreadText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#154734',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
});
