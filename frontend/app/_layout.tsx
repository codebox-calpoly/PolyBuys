import { Stack } from 'expo-router';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

// Web-compatible storage: use localStorage on web, AsyncStorage on native
const storage = Platform.select({
  web: {
    getItem: async (key: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    },
    setItem: async (key: string, value: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    },
    removeItem: async (key: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    },
  },
  default: {
    getItem: (key: string) => AsyncStorage.getItem(key),
    setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
    removeItem: (key: string) => AsyncStorage.removeItem(key),
  },
})!;

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex} storage={storage}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'PolyBuys' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="l/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="listings/[id]" options={{ title: 'Listing Details' }} />
        <Stack.Screen name="listings/new" options={{ title: 'Create Listing' }} />
        <Stack.Screen name="listings/[id]/edit" options={{ title: 'Edit Listing' }} />
        <Stack.Screen name="auth/login" options={{ title: 'Sign In', headerShown: false }} />
      </Stack>
    </ConvexAuthProvider>
  );
}
