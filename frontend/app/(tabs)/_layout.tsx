import { useEffect, useMemo, useState } from 'react';
import { Link, Slot, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { colors, typography } from '../../theme/tokens';

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
    pathname === '/'
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
        pathname: '/' as never,
        params: trimmed.length > 0 ? { ...mergedParams, q: trimmed } : mergedParams,
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [currentQuery, mergedParams, router, searchInput]);

  return (
    <View style={styles.webRoot}>
      <View style={styles.webHeaderBorder}>
        <View style={styles.webHeaderContent}>
          <Link href="/" asChild>
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
  const colorScheme = useColorScheme();
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

  const isDarkMode = colorScheme === 'dark';
  const tabTint = isDarkMode ? colors.white : colors.primary;

  const nativeTabs = (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={tabTint}
      labelStyle={styles.nativeTabLabel}
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        {/* NativeTabs expects plain text inside Trigger.Label. */}
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search" disableTransparentOnScrollEdge>
        {/* NativeTabs expects plain text inside Trigger.Label. */}
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }}
          md="search"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-listings" disableTransparentOnScrollEdge>
        {/* NativeTabs expects plain text inside Trigger.Label. */}
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>My Listings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }}
          md="view_list"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox" disableTransparentOnScrollEdge>
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
      <NativeTabs.Trigger name="settings" disableTransparentOnScrollEdge>
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
    backgroundColor: colors.white,
  },
  webHeaderBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  webHeaderContent: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brand: {
    ...typography.title1,
    color: colors.primary,
  },
  webSearchControl: {
    minWidth: 260,
    maxWidth: 320,
    width: '100%',
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  webSearchControlActive: {
    backgroundColor: colors.surface,
    borderColor: colors.locationDark,
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
  nativeTabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
