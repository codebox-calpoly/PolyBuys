import { Stack } from 'expo-router';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex} storage={storage}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'PolyBuys' }} />
        <Stack.Screen name="listings/[id]" options={{ title: 'Listing Details' }} />
        <Stack.Screen name="listings/new" options={{ title: 'Create Listing' }} />
        <Stack.Screen name="listings/[id]/edit" options={{ title: 'Edit Listing' }} />
        <Stack.Screen name="auth/login" options={{ title: 'Sign In', headerShown: false }} />
      </Stack>
    </ConvexAuthProvider>
  );
}
