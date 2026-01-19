import { useAuthActions, useAuthStore } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { User } from '@polybuys/shared';

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
    flow: 'signIn' | 'signUp',
    name?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

/**
 * Custom hook for authentication
 * Wraps Convex Auth hooks and provides user data
 */
export function useAuth(): UseAuthReturn {
  const { signIn: authSignIn, signOut: authSignOut } = useAuthActions();
  const authStore = useAuthStore();

  // Get current user from database
  const user = useQuery(api.users.getCurrentUser);
  const isLoading = authStore === undefined || user === undefined;
  const isAuthenticated = authStore !== null && user !== null;

  const signIn = async (
    email: string,
    password: string,
    flow: 'signIn' | 'signUp',
    name?: string
  ): Promise<void> => {
    try {
      await authSignIn('password', {
        email,
        password,
        flow,
        ...(name && { name }),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      throw new Error(errorMessage);
    }
  };

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
    signIn,
    signOut,
    error: null,
  };
}
