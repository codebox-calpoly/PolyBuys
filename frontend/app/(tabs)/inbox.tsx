import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useAuth } from '../../hooks/useAuth';

type ConversationRowItem = {
  _id: string;
  updatedAt?: number;
  hasUnread?: boolean;
  lastMessagePreview?: string;
  lastMessageAt?: number;
  otherUser?: {
    name?: string;
  };
  listing?: {
    id?: Id<'listings'>;
    title?: string;
    thumbnailUrl?: string | null;
  };
};

function ItemSeparator() {
  return <View style={styles.separator} />;
}

function ConversationRow({
  item,
  index,
  entranceStyle,
  onPress,
  formatTimestamp,
}: {
  item: ConversationRowItem;
  index: number;
  entranceStyle: object;
  onPress: () => void;
  formatTimestamp: (timestamp: number) => string;
}) {
  const hasUnread = Boolean(item.hasUnread);
  const otherUserName = item.otherUser?.name ?? 'User';
  const listingTitle = item.listing?.title ?? 'Listing unavailable';
  const thumbnail = item.listing?.thumbnailUrl ?? null;

  const lastMessagePreview = item.lastMessagePreview ?? 'Conversation started';
  const lastMessageAt = item.lastMessageAt ?? item.updatedAt ?? Date.now();

  return (
    <Animated.View style={index === 0 ? entranceStyle : null}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.buttonPressed]}
        onPress={onPress}
      >
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Text style={styles.thumbnailPlaceholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.otherUserName, hasUnread && styles.unreadText]} numberOfLines={1}>
              {otherUserName}
            </Text>
            <Text style={styles.timestamp}>{formatTimestamp(lastMessageAt)}</Text>
          </View>
          <Text style={styles.listingTitle} numberOfLines={1}>
            {listingTitle}
          </Text>
          <View style={styles.previewRow}>
            <Text style={[styles.messagePreview, hasUnread && styles.unreadText]} numberOfLines={1}>
              {lastMessagePreview}
            </Text>
            {hasUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const conversations = useQuery(api.messages.listUserConversations, isAuthenticated ? {} : 'skip');

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    []
  );

  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    []
  );

  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
      }),
    []
  );

  const formatTimestamp = useCallback(
    (timestamp: number) => {
      const value = new Date(timestamp);
      const now = new Date();
      const sameDay = value.toDateString() === now.toDateString();
      if (sameDay) {
        return formatter.format(value);
      }

      const diff = now.getTime() - value.getTime();
      if (diff < 1000 * 60 * 60 * 24 * 7) {
        return weekdayFormatter.format(value);
      }

      return shortDateFormatter.format(value);
    },
    [formatter, weekdayFormatter, shortDateFormatter]
  );

  if (authLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.stateText}>Loading inbox...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Sign in to view your inbox</Text>
        <Pressable
          style={({ pressed }) => [styles.signInButton, pressed && styles.buttonPressed]}
          onPress={() => router.push('/auth/login?returnTo=%2Finbox' as never)}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (conversations === undefined) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color="#154734" />
        <Text style={styles.stateText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item._id}
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ListEmptyComponent={
        <Animated.View style={[styles.card, entranceStyle]}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyBody}>Start by messaging a seller from any listing page.</Text>
        </Animated.View>
      }
      renderItem={({ item, index }) => {
        return (
          <ConversationRow
            item={item as ConversationRowItem}
            index={index}
            entranceStyle={entranceStyle}
            formatTimestamp={formatTimestamp}
            onPress={() =>
              router.push({
                pathname: '/conversations/[id]',
                params: { id: String(item._id) },
              } as never)
            }
          />
        );
      }}
      ItemSeparatorComponent={ItemSeparator}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f7f5',
  },
  centeredState: {
    flex: 1,
    backgroundColor: '#f3f7f5',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  stateTitle: {
    fontSize: 20,
    color: '#0f2b21',
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 15,
    color: '#5a6f65',
  },
  signInButton: {
    marginTop: 8,
    backgroundColor: '#154734',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  signInButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 26,
    gap: 10,
  },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8e6df',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#eef2ef',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 10,
    color: '#7d8f85',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  otherUserName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f2b21',
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7f75',
    fontVariant: ['tabular-nums'],
  },
  listingTitle: {
    fontSize: 13,
    color: '#4d6358',
    fontWeight: '500',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messagePreview: {
    flex: 1,
    fontSize: 15,
    color: '#5a6f65',
  },
  unreadText: {
    fontWeight: '700',
    color: '#0f2b21',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#154734',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8e6df',
    backgroundColor: '#ffffff',
    padding: 18,
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f2b21',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5a6f65',
    textAlign: 'center',
  },
  separator: {
    height: 10,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
