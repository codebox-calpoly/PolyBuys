import { useEffect } from 'react';
import { Slot, usePathname, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppNavContainer } from '../../components/AppNav';
import { useAuth } from '../../hooks/useAuth';
import { getSignedOutFallback, getVisibleNativeTabs } from '../../lib/navigation/guestAccess';
import { SearchProvider } from '../../contexts/SearchContext';
import { colors } from '../../theme/tokens';
import { nativeChrome } from '../../theme/nativeChrome';

function WebLayout() {
  return (
    <SearchProvider>
      <View style={styles.webRoot}>
        <AppNavContainer />
        <View style={styles.webContent}>
          <Slot />
        </View>
      </View>
    </SearchProvider>
  );
}

export default function TabsLayout() {
  const isWeb = Platform.OS === 'web';
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isSessionLoading } = useAuth();
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

  useEffect(() => {
    if (isWeb || isSessionLoading || isAuthenticated) {
      return;
    }

    const fallback = getSignedOutFallback(pathname);
    if (fallback) {
      router.replace(fallback as never);
    }
  }, [isAuthenticated, isSessionLoading, isWeb, pathname, router]);

  if (isWeb) {
    return <WebLayout />;
  }

  const tabTint = nativeChrome.tabIconSelectedColor;
  const visibleTabs = getVisibleNativeTabs(isAuthenticated);
  const showMyListings = visibleTabs.includes('my-listings');
  const showInbox = visibleTabs.includes('inbox');
  const showSettings = visibleTabs.includes('settings');

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
      {showMyListings ? (
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
      ) : null}
      {showInbox ? (
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
      ) : null}
      {showSettings ? (
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
      ) : null}
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
    flexDirection: 'column',
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  webContent: {
    flex: 1,
    minHeight: 0,
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
