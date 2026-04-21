import { useEffect, useMemo, useState } from 'react';
import { Link, Slot, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { borderRadius, colors, spacing, typography } from '../../theme/tokens';
import { nativeChrome } from '../../theme/nativeChrome';

function WebHeaderLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useLocalSearchParams() as Record<string, string | string[] | undefined>;
  const q = searchParams.q;
  const currentQuery = useMemo(() => {
    if (Array.isArray(q)) {
      return q[0] ?? '';
    }
    return q ?? '';
  }, [q]);
  const [searchInput, setSearchInput] = useState(currentQuery);
  const searchActive =
    pathname === '/home'
      ? searchInput.trim().length > 0
      : pathname === '/search' || pathname.startsWith('/search/');
  const searchControlStyle = StyleSheet.flatten([
    styles.webSearchControl,
    searchActive && styles.webSearchControlActive,
  ]);
  const mergedParams = useMemo(() => {
    const nextParams: Record<string, string | string[]> = {};

    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'q' || value === undefined) {
        continue;
      }
      nextParams[key] = value;
    }

    return nextParams;
  }, [searchParams]);

  useEffect(() => {
    setSearchInput(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === currentQuery) {
        return;
      }

      router.replace({
        pathname: '/home' as never,
        params: trimmed.length > 0 ? { ...mergedParams, q: trimmed } : mergedParams,
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [currentQuery, mergedParams, router, searchInput]);

  return (
    <View style={styles.webRoot}>
      <View style={styles.webHeaderBorder}>
        <View style={styles.webHeaderContent}>
          <Link href="/home" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Go to home">
              <Text style={styles.brand}>PolyBuys</Text>
            </Pressable>
          </Link>
          <View style={searchControlStyle}>
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search listings..."
              placeholderTextColor={colors.muted}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              style={styles.webSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search listings"
            />
          </View>
        </View>
      </View>
      <Slot />
    </View>
  );
}

export default function TabsLayout() {
  const isWeb = Platform.OS === 'web';
  const { isAuthenticated } = useAuth();
  const conversations = useQuery(
    api.messages.listUserConversations,
    isAuthenticated && !isWeb ? {} : 'skip'
  );
  const unreadCount =
    conversations?.reduce(
      (count, conversation) =>
        count + (conversation.unreadCount ?? (conversation.hasUnread ? 1 : 0)),
      0
    ) ?? 0;

  if (isWeb) {
    return <WebHeaderLayout />;
  }

  const tabTint = nativeChrome.tabIconSelectedColor;

  const nativeTabs = (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={tabTint}
      iconColor={{
        default: nativeChrome.tabIconDefaultColor,
        selected: nativeChrome.tabIconSelectedColor,
      }}
      labelStyle={{
        default: styles.nativeTabLabelDefault,
        selected: styles.nativeTabLabelSelected,
      }}
      backgroundColor={nativeChrome.tabBarBackgroundColor}
      blurEffect={nativeChrome.tabBarBlurEffect}
      shadowColor={nativeChrome.tabBarShadowColor}
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger
        name="home"
        disableTransparentOnScrollEdge
        contentStyle={styles.nativeTabContent}
      >
        {/* NativeTabs expects plain text inside Trigger.Label. */}
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="search"
        role="search"
        disableTransparentOnScrollEdge
        contentStyle={styles.nativeTabContent}
      >
        {/* NativeTabs expects plain text inside Trigger.Label. */}
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }}
          md="search"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="my-listings"
        disableTransparentOnScrollEdge
        contentStyle={styles.nativeTabContent}
      >
        {/* NativeTabs expects plain text inside Trigger.Label. */}
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>My Listings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }}
          md="view_list"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="inbox"
        disableTransparentOnScrollEdge
        contentStyle={styles.nativeTabContent}
      >
        {/* NativeTabs expects plain text inside Trigger.Label. */}
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }}
          md="chat"
        />
        {unreadCount > 0 ? (
          <NativeTabs.Trigger.Badge>
            {unreadCount > 9 ? '9+' : String(unreadCount)}
          </NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="settings"
        disableTransparentOnScrollEdge
        contentStyle={styles.nativeTabContent}
      >
        {/* NativeTabs expects plain text inside Trigger.Label. */}
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.circle', selected: 'person.circle.fill' }}
          md="settings"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );

  if (Platform.OS === 'android') {
    return (
      <SafeAreaView style={styles.nativeRoot} edges={['top']}>
        {nativeTabs}
      </SafeAreaView>
    );
  }

  return nativeTabs;
}

const styles = StyleSheet.create({
  nativeRoot: {
    flex: 1,
  },
  webRoot: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  webHeaderBorder: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  webHeaderContent: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  brand: {
    ...typography.title1,
    color: colors.textDark,
    fontSize: 28,
    lineHeight: 34,
  },
  webSearchControl: {
    minWidth: 280,
    maxWidth: 360,
    width: '100%',
    minHeight: 44,
    borderRadius: borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  webSearchControlActive: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
  },
  webSearchInput: {
    ...typography.subhead,
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontWeight: '600',
    color: colors.textDark,
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: 'none',
  },
  nativeTabLabelDefault: {
    fontSize: 11,
    fontWeight: '600',
    color: nativeChrome.tabLabelDefaultColor,
  },
  nativeTabLabelSelected: {
    fontSize: 11,
    fontWeight: '600',
    color: nativeChrome.tabLabelSelectedColor,
  },
  nativeTabContent: {
    backgroundColor: colors.surface,
  },
});
