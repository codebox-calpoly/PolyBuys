import { useRouter, usePathname } from 'expo-router';
import { useAuth } from './useAuth';

/**
 * Hook for gating actions that require authentication
 * Redirects to login with return URL when not authenticated
 */
export function useAuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requireAuth = <T extends (...args: any[]) => any>(
    action: T,
    options?: {
      redirectTo?: string;
    }
  ): ((...args: Parameters<T>) => ReturnType<T> | undefined) => {
    return (...args: Parameters<T>) => {
      if (isLoading) {
        return undefined;
      }

      if (!isAuthenticated) {
        const redirectTo = options?.redirectTo || pathname || '/';
        const loginUrl = `/auth/login?returnTo=${encodeURIComponent(redirectTo)}` as const;

        // Redirect to login with return URL
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(loginUrl as any);
        return undefined;
      }

      return action(...args);
    };
  };

  return {
    requireAuth,
    isAuthenticated,
    isLoading,
  };
}
