import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useAuth } from '../../hooks/useAuth';
import { ScreenState } from '../../components/ScreenState';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import { ScreenHeader } from '../../components/ui';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { nativeChrome } from '../../theme/nativeChrome';

type ConversationRowItem = {
  _id: string;
  updatedAt?: number;
  hasUnread?: boolean;
  unreadCount?: number;
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
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isSessionLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const conversations = useQuery(
    api.messages.listUserConversations,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const [searchText, setSearchText] = useState('');
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

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
    if (!isWeb && !isSessionLoading && !isAuthenticated) {
      router.replace('/auth/login?returnTo=%2Finbox' as never);
    }
  }, [isSessionLoading, isAuthenticated, isWeb, router]);

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

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    const query = searchText.trim().toLowerCase();
    if (query.length === 0) return conversations;
    return conversations.filter((conversation) => {
      const name = conversation.otherUser?.name?.toLowerCase() ?? '';
      const listingTitle = conversation.listing?.title?.toLowerCase() ?? '';
      return name.includes(query) || listingTitle.includes(query);
    });
  }, [conversations, searchText]);

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

  if (isSessionLoading) {
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

  const totalConversations = conversations.length;
  const subtitleParts: string[] = [];
  subtitleParts.push(
    `${totalConversations} ${totalConversations === 1 ? 'conversation' : 'conversations'}`
  );
  if (unreadConversationCount > 0) {
    subtitleParts.push(`${unreadConversationCount} unread`);
  }
  const subtitle = subtitleParts.join(' · ');
  const isSearching = searchText.trim().length > 0;

  return (
    <View style={styles.page}>
      <View style={styles.content}>
        {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
        <View style={styles.headerBlock}>
          <ScreenHeader title="Inbox" subtitle={subtitle} />
          <View style={styles.searchBarWrap}>
            <BlurView intensity={60} tint={nativeChrome.blurTint} style={StyleSheet.absoluteFill} />
            <Feather name="search" size={18} color={colors.textDark} style={styles.searchBarIcon} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search conversations..."
              placeholderTextColor={colors.muted}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search conversations"
            />
            {searchText.length > 0 ? (
              <Pressable
                onPress={() => setSearchText('')}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                hitSlop={8}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item._id}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xxl },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <ScreenState
                variant="empty"
                title={isSearching ? 'No matches' : 'No conversations yet'}
                message={
                  isSearching
                    ? `Nothing matched "${searchText.trim()}". Try a different name or listing.`
                    : 'Start by messaging a seller from any listing page.'
                }
              />
            </View>
          }
          renderItem={({ item, index }) => (
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
          )}
          ItemSeparatorComponent={ItemSeparator}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  headerBlock: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  centeredState: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  stateText: {
    ...typography.subhead,
    color: colors.text,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  searchBarIcon: {
    marginRight: spacing.sm,
    opacity: 0.7,
  },
  searchInput: {
    flex: 1,
    ...typography.subhead,
    fontSize: 15,
    color: colors.textDark,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  clearButtonText: {
    ...typography.footnote,
    fontSize: 12,
    color: colors.white,
    fontWeight: '700',
    lineHeight: 13,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  emptyCard: {
    marginTop: spacing.xxl,
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  separator: {
    height: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
