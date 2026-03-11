import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ConvexReactClient } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { usePushNotifications } from '../hooks/usePushNotifications';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ConvexAuthProvider client={convex} storage={storage}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <PushNotificationsBootstrap />
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
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
          <Stack.Screen name="auth/login" options={{ title: 'Sign In', headerShown: false }} />
          <Stack.Screen name="l/[id]" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}
