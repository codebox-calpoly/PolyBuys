import * as Sentry from '@sentry/react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ConvexReactClient } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FlashProvider } from '../contexts/FlashContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { getRequiredExpoPublicEnv } from '../lib/env';
import { colors, typography } from '../theme/tokens';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.surface,
    card: colors.surface,
    text: colors.textDark,
    border: colors.border,
    notification: colors.category,
  },
};

const allowSentryPii = process.env.EXPO_PUBLIC_ENABLE_SENTRY_PII === 'true';
const convexUrl = getRequiredExpoPublicEnv('EXPO_PUBLIC_CONVEX_URL');
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

Sentry.init({
  dsn: 'https://ed516d30275214d7429df46a33c04764@o4510288242933760.ingest.us.sentry.io/4511024032382976',
  sendDefaultPii: allowSentryPii,
  debug: __DEV__,
  // spotlight: __DEV__,
});

const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

const storage = {
  getItem: async (key: string) => {
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

function PushNotificationsBootstrap() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  usePushNotifications(isAuthenticated, isLoading);
  return null;
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ConvexAuthProvider client={convex} storage={storage}>
          <ThemeProvider value={navigationTheme}>
            <FlashProvider>
              <PushNotificationsBootstrap />
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerBackButtonDisplayMode: 'minimal',
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.textDark,
                  headerTitleStyle: {
                    ...typography.heading,
                    color: colors.textDark,
                  },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: colors.surface },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
                <Stack.Screen
                  name="listings/[id]"
                  options={{ title: 'Listing Details', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="listings/new"
                  options={{ title: 'Create Listing', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="listings/[id]/edit"
                  options={{ title: 'Edit Listing', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="messages/[id]"
                  options={{ title: 'Messages', headerBackTitle: 'Back' }}
                />
                <Stack.Screen
                  name="conversations/[id]"
                  options={{ title: 'Conversation', headerBackTitle: 'Inbox' }}
                />
                <Stack.Screen
                  name="conversations/new"
                  options={{
                    title: 'New Message',
                    headerBackTitle: 'Back',
                    presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal',
                    sheetGrabberVisible: true,
                    sheetAllowedDetents: [0.75, 1.0],
                  }}
                />
                <Stack.Screen
                  name="auth/login"
                  options={{
                    title: 'Sign In',
                    headerBackTitle: 'Back',
                    headerShown: Platform.OS !== 'web',
                  }}
                />
                <Stack.Screen
                  name="account-settings"
                  options={{ title: 'Settings', headerBackTitle: 'Profile' }}
                />
                <Stack.Screen
                  name="profile/edit"
                  options={{ title: 'Edit Profile', headerBackTitle: 'Profile' }}
                />
                <Stack.Screen
                  name="profile/[userId]"
                  options={{ title: 'Profile', headerBackTitle: 'Back' }}
                />
                <Stack.Screen name="privacy" options={{ headerShown: false }} />
                <Stack.Screen name="terms" options={{ headerShown: false }} />
                <Stack.Screen name="landing" options={{ headerShown: false }} />
                <Stack.Screen name="l/[id]" options={{ headerShown: false }} />
              </Stack>
            </FlashProvider>
          </ThemeProvider>
        </ConvexAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default Sentry.wrap(RootLayout);
