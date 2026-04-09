import { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useAuth } from '../../hooks/useAuth';
import { ScreenState } from '../../components/ScreenState';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

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
        accessibilityRole="button"
        accessibilityLabel={`Conversation with ${otherUserName} about ${listingTitle}`}
      >
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Text style={styles.thumbnailPlaceholderText}>No image</Text>
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
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const conversations = useQuery(
    api.messages.listUserConversations,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const isDesktopWeb = isWeb && width >= 1024;

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

  useEffect(() => {
    if (!isWeb && !authLoading && !isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Finbox' as never);
    }
  }, [authLoading, isAuthenticated, isWeb, router]);

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
  const unreadConversationCount =
    conversations?.filter(
      (conversation) => Boolean(conversation.hasUnread) || (conversation.unreadCount ?? 0) > 0
    ).length ?? 0;
  const unreadMessageCount =
    conversations?.reduce(
      (sum, conversation) => sum + (conversation.unreadCount ?? (conversation.hasUnread ? 1 : 0)),
      0
    ) ?? 0;

  if (isWeb) {
    return (
      <OpenInAppPrompt
        title="Open your inbox in the mobile app"
        body="Messaging works best on mobile, where you can reply quickly and stay on top of new conversations."
        path="/inbox"
        buttonLabel="Open Inbox in App"
        secondaryActionLabel="Back to home"
        onSecondaryAction={() => router.replace('/')}
      />
    );
  }

  if (authLoading) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.stateText}>Loading inbox...</Text>
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

  if (conversations === undefined) {
    return (
      <View style={styles.centeredState}>
        <ScreenState variant="loading" title="Loading conversations..." />
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
      ListHeaderComponent={
        <Animated.View style={[styles.heroCard, entranceStyle]}>
          <View style={[styles.heroTopRow, isDesktopWeb && styles.heroTopRowDesktop]}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Inbox</Text>
              <Text style={styles.heroTitle}>Keep conversations moving</Text>
              <Text style={styles.heroBody}>
                Reply quickly, stay on top of unread messages, and keep listing interest warm.
              </Text>
            </View>
            <View style={[styles.heroStatsRow, isDesktopWeb && styles.heroStatsRowDesktop]}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{conversations.length}</Text>
                <Text style={styles.heroStatLabel}>Conversations</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{unreadConversationCount}</Text>
                <Text style={styles.heroStatLabel}>Unread chats</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatNumber}>{unreadMessageCount}</Text>
                <Text style={styles.heroStatLabel}>Unread messages</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      }
      ListEmptyComponent={
        <Animated.View style={[styles.card, entranceStyle]}>
          <ScreenState
            variant="empty"
            title="No conversations yet"
            message="Start by messaging a seller from any listing page."
          />
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
    backgroundColor: colors.background,
  },
  centeredState: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  stateText: {
    ...typography.subhead,
    color: colors.text,
  },
  content: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  heroCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    boxShadow: '0 18px 40px rgba(21, 71, 52, 0.08)',
  },
  heroTopRow: {
    gap: spacing.lg,
  },
  heroTopRowDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroEyebrow: {
    ...typography.footnote,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...typography.title1,
    color: colors.textDark,
    fontSize: 28,
    lineHeight: 34,
  },
  heroBody: {
    ...typography.subhead,
    color: colors.text,
    maxWidth: 560,
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  heroStatsRowDesktop: {
    justifyContent: 'flex-end',
  },
  heroStat: {
    minWidth: 116,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 2,
  },
  heroStatNumber: {
    ...typography.title2,
    color: colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  heroStatLabel: {
    ...typography.footnote,
    color: colors.text,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    boxShadow: '0 10px 24px rgba(21, 71, 52, 0.06)',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    ...typography.footnote,
    color: colors.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  otherUserName: {
    flex: 1,
    ...typography.heading,
    color: colors.textDark,
  },
  timestamp: {
    ...typography.footnote,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  listingTitle: {
    ...typography.footnoteMed,
    color: colors.text,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messagePreview: {
    flex: 1,
    ...typography.subhead,
    color: colors.text,
  },
  unreadText: {
    fontWeight: '700',
    color: colors.textDark,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
    boxShadow: '0 16px 36px rgba(21, 71, 52, 0.06)',
  },
  separator: {
    height: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
