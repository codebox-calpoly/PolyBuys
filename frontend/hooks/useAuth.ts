import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { User } from '@polybuys/shared';

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isSessionLoading: boolean;
  isUserLoading: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const authActions = useAuthActions();
  const authSignOut = authActions?.signOut;
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const removePushToken = useMutation(api.pushNotifications.removePushToken);

  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? undefined : 'skip');
  const isSessionLoading = authLoading;
  const isUserLoading = isAuthenticated && user === undefined;
  const isLoading = isSessionLoading;

  const signOut = async (): Promise<void> => {
    if (!authSignOut) {
      console.warn('[useAuth] signOut called before auth provider ready');
      return;
    }
    try {
      // Best-effort cleanup while still authenticated to avoid leaving stale tokens.
      try {
        await removePushToken({});
      } catch (error) {
        console.warn('Failed to remove push token before sign-out', error);
      }
      await authSignOut();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
      throw new Error(errorMessage);
    }
  };

  return {
    user: user || null,
    isAuthenticated,
    isSessionLoading,
    isUserLoading,
    isLoading,
    signOut,
  };
}
