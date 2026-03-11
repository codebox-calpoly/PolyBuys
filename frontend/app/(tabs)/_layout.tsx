import { Link, Slot, usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { colors, typography } from '../../theme/tokens';

type WebTab = {
  href: '/' | '/search' | '/my-listings' | '/inbox' | '/settings';
  label: 'Home' | 'Search' | 'My Listings' | 'Inbox' | 'Profile';
};

const webTabs: WebTab[] = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search' },
  { href: '/my-listings', label: 'My Listings' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/settings', label: 'Profile' },
];

function isTabActive(pathname: string, href: WebTab['href']) {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function WebTabsHeaderLayout({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();

  return (
    <View style={styles.webRoot}>
      <View style={styles.webHeaderBorder}>
        <View style={styles.webHeaderContent}>
          <Text style={styles.brand}>PolyBuys</Text>
          <View style={styles.webTabsPill}>
            {webTabs.map((tab) => {
              const active = isTabActive(pathname, tab.href);
              const tabButtonStyle = StyleSheet.flatten([
                styles.webTabButton,
                active && styles.webTabButtonActive,
              ]);
              const tabLabelStyle = StyleSheet.flatten([
                styles.webTabLabel,
                active && styles.webTabLabelActive,
              ]);

              const isInboxTab = tab.href === '/inbox';
              const showUnreadBadge = isInboxTab && unreadCount > 0;
              const formattedUnreadCount = unreadCount > 9 ? '9+' : String(unreadCount);

              return (
                <Link key={tab.href} href={tab.href as never} asChild>
                  <Pressable style={tabButtonStyle}>
                    <View style={styles.webTabInner}>
                      <Text style={tabLabelStyle}>{tab.label}</Text>
                      {showUnreadBadge ? (
                        <View style={styles.webUnreadBadge}>
                          <Text style={styles.webUnreadBadgeText}>{formattedUnreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>
      <Slot />
    </View>
  );
}

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated } = useAuth();
  const conversations = useQuery(api.messages.listUserConversations, isAuthenticated ? {} : 'skip');
  const unreadCount =
    conversations?.reduce(
      (count, conversation) =>
        count + (conversation.unreadCount ?? (conversation.hasUnread ? 1 : 0)),
      0
    ) ?? 0;

  if (Platform.OS === 'web') {
    return <WebTabsHeaderLayout unreadCount={unreadCount} />;
  }

  const isDarkMode = colorScheme === 'dark';
  const tabTint = isDarkMode ? colors.white : colors.primary;

  return (
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
}

const styles = StyleSheet.create({
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
    maxWidth: 1120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: {
    ...typography.title1,
    color: colors.primary,
  },
  webTabsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 4,
    gap: 4,
  },
  webTabButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  webTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  webTabButtonActive: {
    backgroundColor: colors.primary,
  },
  webTabLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.text,
  },
  webTabLabelActive: {
    color: colors.white,
  },
  webUnreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.category,
  },
  webUnreadBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  headerSpacer: {
    width: 84,
  },
  nativeTabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
