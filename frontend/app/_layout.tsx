import { Stack } from 'expo-router';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { StatusBar } from 'expo-status-bar';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'PolyBuys' }} />
        <Stack.Screen name="listings/[id]" options={{ title: 'Listing Details' }} />
        <Stack.Screen name="auth/login" options={{ title: 'Sign In', headerShown: false }} />
      </Stack>
    </ConvexAuthProvider>
  );
}
