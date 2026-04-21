export type LoginStep =
  | 'welcome'
  | 'email'
  | { email: string }
  | 'checking'
  | 'profile'
  | 'push'
  | 'success';

export type LoginEntryAction = 'post-auth-redirect' | 'profile' | null;

interface GetLoginEntryActionArgs {
  isSessionLoading: boolean;
  isAuthenticated: boolean;
  currentProfile: object | null | undefined;
  step: LoginStep;
}

export function getLoginEntryAction({
  isSessionLoading,
  isAuthenticated,
  currentProfile,
  step,
}: GetLoginEntryActionArgs): LoginEntryAction {
  if (isSessionLoading || !isAuthenticated || currentProfile === undefined) {
    return null;
  }

  if (step !== 'welcome' && step !== 'email') {
    return null;
  }

  return currentProfile ? 'post-auth-redirect' : 'profile';
}
