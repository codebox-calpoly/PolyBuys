import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { useEntranceAnimation } from '../../hooks/useEntranceAnimation';
import { useAuth } from '../../hooks/useAuth';
import { useResolvedImageUrls } from '../../hooks/useResolvedImageUrls';
import ProfileAvatar from '../../components/ProfileAvatar';
import { ScreenState } from '../../components/ScreenState';
import OpenInAppPrompt from '../../components/OpenInAppPrompt';
import { ScreenHeader } from '../../components/ui';
import { ReportModal } from '../../components/ReportModal';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { nativeChrome } from '../../theme/nativeChrome';

const SWIPE_LEFT_ACTION_WIDTH = 176;
const SWIPE_LEFT_OPEN_THRESHOLD = 84;
const SWIPE_RIGHT_OPEN_CHAT_THRESHOLD = 64;
const SWIPE_RIGHT_MAX_TRANSLATE = 90;

type ConversationRowItem = {
  _id: Id<'conversations'>;
  updatedAt?: number;
  hasUnread?: boolean;
  unreadCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: number;
  siblingConversationIds?: Id<'conversations'>[];
  otherUser?: {
    name?: string;
    picture?: string;
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
  avatarUrl,
  entranceStyle,
  activeSwipeConversationId,
  setActiveSwipeConversationId,
  onPress,
  onDelete,
  onReport,
  formatTimestamp,
}: {
  item: ConversationRowItem;
  index: number;
  avatarUrl: string | null;
  entranceStyle: object;
  activeSwipeConversationId: Id<'conversations'> | null;
  setActiveSwipeConversationId: (conversationId: Id<'conversations'> | null) => void;
  onPress: () => void;
  onDelete: () => void;
  onReport: () => void;
  formatTimestamp: (timestamp: number) => string;
}) {
  const hasUnread = Boolean(item.hasUnread);
  const otherUserName = item.otherUser?.name ?? 'User';
  const listingTitle = item.listing?.title ?? 'Listing unavailable';
  const lastMessagePreview = item.lastMessagePreview ?? 'Conversation started';
  const lastMessageAt = item.lastMessageAt ?? item.updatedAt ?? Date.now();

  const translateX = useRef(new Animated.Value(0)).current;
  const swipeStartOffset = useRef(0);
  const isLeftOpenRef = useRef(false);

  const animateTo = useCallback(
    (toValue: number, onComplete?: () => void) => {
      Animated.spring(translateX, {
        toValue,
        damping: 22,
        stiffness: 260,
        mass: 0.55,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && onComplete) {
          onComplete();
        }
      });
    },
    [translateX]
  );

  const closeSwipeActions = useCallback(
    (animated: boolean) => {
      if (animated) {
        animateTo(0);
      } else {
        translateX.setValue(0);
      }
      if (activeSwipeConversationId === item._id) {
        setActiveSwipeConversationId(null);
      }
      isLeftOpenRef.current = false;
    },
    [activeSwipeConversationId, animateTo, item._id, setActiveSwipeConversationId, translateX]
  );

  useEffect(() => {
    if (activeSwipeConversationId !== item._id && isLeftOpenRef.current) {
      closeSwipeActions(true);
    }
  }, [activeSwipeConversationId, closeSwipeActions, item._id]);

  const openLeftActions = useCallback(() => {
    isLeftOpenRef.current = true;
    setActiveSwipeConversationId(item._id);
    animateTo(-SWIPE_LEFT_ACTION_WIDTH);
  }, [animateTo, item._id, setActiveSwipeConversationId]);

  const triggerOpenChat = useCallback(() => {
    setActiveSwipeConversationId(null);
    isLeftOpenRef.current = false;
    Animated.sequence([
      Animated.timing(translateX, {
        toValue: 34,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onPress();
    });
  }, [onPress, setActiveSwipeConversationId, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const isHorizontal =
            Math.abs(gestureState.dx) > 10 &&
            Math.abs(gestureState.dy) < 12 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4;
          if (!isHorizontal) {
            return false;
          }
          return gestureState.dx < -8 || gestureState.dx > 8;
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation((currentValue) => {
            swipeStartOffset.current = currentValue;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
            return;
          }
          const next = Math.max(
            -SWIPE_LEFT_ACTION_WIDTH,
            Math.min(SWIPE_RIGHT_MAX_TRANSLATE, swipeStartOffset.current + gestureState.dx)
          );
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gestureState) => {
          const resolvedOffset = swipeStartOffset.current + gestureState.dx;
          const shouldOpenChat =
            resolvedOffset >= SWIPE_RIGHT_OPEN_CHAT_THRESHOLD ||
            (gestureState.vx > 0.65 && gestureState.dx > 20);
          if (shouldOpenChat) {
            triggerOpenChat();
            return;
          }

          const shouldOpenLeftActions =
            resolvedOffset <= -SWIPE_LEFT_OPEN_THRESHOLD ||
            (gestureState.vx < -0.65 && gestureState.dx < -20);
          if (shouldOpenLeftActions) {
            openLeftActions();
            return;
          }

          closeSwipeActions(true);
        },
        onPanResponderTerminate: () => {
          closeSwipeActions(true);
        },
      }),
    [closeSwipeActions, openLeftActions, translateX, triggerOpenChat]
  );

  const handleDeletePress = useCallback(() => {
    closeSwipeActions(true);
    onDelete();
  }, [closeSwipeActions, onDelete]);

  const handleReportPress = useCallback(() => {
    closeSwipeActions(true);
    onReport();
  }, [closeSwipeActions, onReport]);

  const handleRowPress = useCallback(() => {
    if (isLeftOpenRef.current) {
      closeSwipeActions(true);
      return;
    }
    onPress();
  }, [closeSwipeActions, onPress]);

  return (
    <Animated.View style={index === 0 ? entranceStyle : null}>
      <View style={styles.swipeRowShell}>
        <View style={styles.rightSwipeActions}>
          <Pressable
            style={[styles.swipeActionButton, styles.reportActionButton]}
            onPress={handleReportPress}
            accessibilityRole="button"
            accessibilityLabel={`Report conversation with ${otherUserName}`}
          >
            <Text style={styles.swipeActionLabel}>Report</Text>
          </Pressable>
          <Pressable
            style={[styles.swipeActionButton, styles.deleteActionButton]}
            onPress={handleDeletePress}
            accessibilityRole="button"
            accessibilityLabel={`Delete conversation with ${otherUserName}`}
          >
            <Text style={styles.swipeActionLabel}>Delete</Text>
          </Pressable>
        </View>
        <Animated.View
          style={[styles.swipeCard, { transform: [{ translateX }] }]}
          {...panResponder.panHandlers}
        >
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.buttonPressed]}
            onPress={handleRowPress}
            accessibilityRole="button"
            accessibilityLabel={`Conversation with ${otherUserName} about ${listingTitle}`}
          >
            <ProfileAvatar uri={avatarUrl} name={otherUserName} size={56} style={styles.avatar} />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text
                  style={[styles.otherUserName, hasUnread && styles.unreadText]}
                  numberOfLines={1}
                >
                  {otherUserName}
                </Text>
                <Text style={styles.timestamp}>{formatTimestamp(lastMessageAt)}</Text>
              </View>
              <Text style={styles.listingTitle} numberOfLines={1}>
                {listingTitle}
              </Text>
              <View style={styles.previewRow}>
                <Text
                  style={[styles.messagePreview, hasUnread && styles.unreadText]}
                  numberOfLines={1}
                >
                  {lastMessagePreview}
                </Text>
                {hasUnread && <View style={styles.unreadDot} />}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated, isSessionLoading } = useAuth();
  const entranceStyle = useEntranceAnimation();
  const hideConversationFromInbox = useMutation(api.messages.hideConversationFromInbox);
  const conversations = useQuery(
    api.messages.listUserConversations,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const [searchText, setSearchText] = useState('');
  const [activeSwipeConversationId, setActiveSwipeConversationId] =
    useState<Id<'conversations'> | null>(null);
  const [reportingConversation, setReportingConversation] = useState<ConversationRowItem | null>(
    null
  );
  const topSafeSpace = Platform.OS === 'ios' ? Math.max(insets.top - 6, 10) : 0;

  const openConversation = useCallback(
    (conversationId: Id<'conversations'>) => {
      router.push({
        pathname: '/conversations/[id]',
        params: { id: String(conversationId) },
      } as never);
    },
    [router]
  );

  const hideConversation = useCallback(
    async (item: ConversationRowItem) => {
      try {
        await hideConversationFromInbox({
          conversationId: item._id,
          siblingConversationIds: item.siblingConversationIds,
        });
      } catch (error) {
        const message = String((error as Error)?.message ?? 'Unable to delete this conversation.');
        Alert.alert('Delete failed', message);
      }
    },
    [hideConversationFromInbox]
  );

  const promptDeleteConversation = useCallback(
    (item: ConversationRowItem) => {
      Alert.alert(
        'Delete conversation?',
        'This hides the thread from your inbox until a new message arrives.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void hideConversation(item);
            },
          },
        ]
      );
    },
    [hideConversation]
  );

  const handleBackgroundPress = useCallback(() => {
    setActiveSwipeConversationId(null);
    Keyboard.dismiss();
  }, []);

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

  const otherUserPictureIds = useMemo(
    () =>
      (conversations ?? [])
        .map((conversation) => conversation.otherUser?.picture)
        .filter(
          (pictureId): pictureId is Id<'_storage'> =>
            typeof pictureId === 'string' && pictureId.length > 0
        ),
    [conversations]
  );

  const { resolvedUrls: resolvedOtherUserAvatarUrls } = useResolvedImageUrls(otherUserPictureIds);

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
    <TouchableWithoutFeedback onPress={handleBackgroundPress} accessible={false}>
      <View style={styles.page}>
        <View style={styles.content}>
          {topSafeSpace > 0 && <View style={{ height: topSafeSpace }} />}
          <View style={styles.headerBlock}>
            <ScreenHeader title="Inbox" subtitle={subtitle} />
            <View style={styles.searchBarWrap}>
              <BlurView
                intensity={60}
                tint={nativeChrome.blurTint}
                style={StyleSheet.absoluteFill}
              />
              <Feather
                name="search"
                size={18}
                color={colors.textDark}
                style={styles.searchBarIcon}
              />
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
                onSubmitEditing={() => {
                  Keyboard.dismiss();
                }}
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
            keyExtractor={(item) => String(item._id)}
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + spacing.xxl },
            ]}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => {
              setActiveSwipeConversationId(null);
              Keyboard.dismiss();
            }}
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
            renderItem={({ item, index }) => {
              const conversation = item as ConversationRowItem;
              const pictureId =
                typeof conversation.otherUser?.picture === 'string'
                  ? conversation.otherUser.picture
                  : null;
              const avatarUrl = pictureId ? (resolvedOtherUserAvatarUrls[pictureId] ?? null) : null;

              return (
                <ConversationRow
                  item={conversation}
                  index={index}
                  avatarUrl={avatarUrl}
                  entranceStyle={entranceStyle}
                  activeSwipeConversationId={activeSwipeConversationId}
                  setActiveSwipeConversationId={setActiveSwipeConversationId}
                  formatTimestamp={formatTimestamp}
                  onPress={() => openConversation(item._id)}
                  onDelete={() => promptDeleteConversation(conversation)}
                  onReport={() => setReportingConversation(conversation)}
                />
              );
            }}
            ItemSeparatorComponent={ItemSeparator}
          />
        </View>
        <ReportModal
          isVisible={reportingConversation !== null}
          onClose={() => setReportingConversation(null)}
          targetId={reportingConversation ? String(reportingConversation._id) : ''}
          targetType="conversation"
        />
      </View>
    </TouchableWithoutFeedback>
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
  swipeRowShell: {
    position: 'relative',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  swipeCard: {
    borderRadius: borderRadius.lg,
  },
  rightSwipeActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_LEFT_ACTION_WIDTH,
    flexDirection: 'row',
  },
  swipeActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportActionButton: {
    backgroundColor: colors.text,
  },
  deleteActionButton: {
    backgroundColor: colors.destructive,
  },
  swipeActionLabel: {
    ...typography.footnoteMed,
    fontWeight: '700',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
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
    backgroundColor: colors.surface,
  },
});
