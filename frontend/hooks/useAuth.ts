import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { User } from '@polybuys/shared';

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

/**
 * Custom hook for authentication
 * Wraps Convex Auth hooks and provides user data
 *
 * Note: For OTP sign-in, use useAuthActions().signIn directly in the login screen
 */
export function useAuth(): UseAuthReturn {
  const { signOut: authSignOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  // Get current user from database (skip query when not authenticated)
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? undefined : 'skip');
  const isLoading = authLoading || (isAuthenticated && user === undefined);

  const signOut = async (): Promise<void> => {
    try {
      await authSignOut();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
      throw new Error(errorMessage);
    }
  };

  return {
    user: user || null,
    isAuthenticated,
    isLoading,
    signOut,
  };
}
