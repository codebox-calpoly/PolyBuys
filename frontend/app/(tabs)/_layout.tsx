import { Link, Slot, usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

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

function WebTabsHeaderLayout() {
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

              return (
                <Link key={tab.href} href={tab.href as never} asChild>
                  <Pressable style={tabButtonStyle}>
                    <Text style={tabLabelStyle}>{tab.label}</Text>
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

  if (Platform.OS === 'web') {
    return <WebTabsHeaderLayout />;
  }

  const isDarkMode = colorScheme === 'dark';
  const tabTint = Platform.OS === 'ios' ? (isDarkMode ? '#ffffff' : '#111111') : '#154734';
  const nativeTabLabelStyle = Platform.OS === 'ios' ? styles.iosTabLabel : undefined;

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={tabTint}
      labelStyle={nativeTabLabelStyle}
    >
      <NativeTabs.Trigger name="index" disableScrollToTop>
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search" disableScrollToTop>
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-listings" disableScrollToTop>
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>My Listings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox" disableScrollToTop>
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" disableScrollToTop>
        {/* eslint-disable-next-line react-native/no-raw-text */}
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.circle', selected: 'person.circle.fill' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webHeaderBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
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
    fontSize: 22,
    fontWeight: '700',
    color: '#154734',
  },
  webTabsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8d8d8',
    backgroundColor: '#f5f5f5',
    padding: 4,
    gap: 4,
  },
  webTabButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  webTabButtonActive: {
    backgroundColor: '#154734',
  },
  webTabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  webTabLabelActive: {
    color: '#fff',
  },
  headerSpacer: {
    width: 84,
  },
  iosTabLabel: {
    color: '#111111',
  },
});
