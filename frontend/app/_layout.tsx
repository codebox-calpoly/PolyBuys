import { Stack } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { AuthProvider } from '@convex-dev/auth/react';
import { StatusBar } from 'expo-status-bar';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="index" options={{ title: 'PolyBuy' }} />
          <Stack.Screen name="listings/[id]" options={{ title: 'Listing Details' }} />
          <Stack.Screen name="auth/signup" options={{ title: 'Sign Up' }} />
          <Stack.Screen name="auth/login" options={{ title: 'Sign In' }} />
          <Stack.Screen name="auth/verify-email" options={{ title: 'Verify Email' }} />
        </Stack>
      </AuthProvider>
    </ConvexProvider>
  );
}
