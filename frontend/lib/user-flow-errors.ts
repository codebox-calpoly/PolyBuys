export type UserFlowErrorContext =
  | 'sign-out'
  | 'delete-account'
  | 'post-delete-signout'
  | 'block-user'
  | 'unblock-user'
  | 'notifications-enable'
  | 'notifications-disable'
  | 'prepare-profile-image'
  | 'save-profile'
  | 'send-first-message'
  | 'send-message'
  | 'create-listing'
  | 'update-listing'
  | 'save-listing'
  | 'mark-listing-sold'
  | 'submit-report'
  | 'open-in-app'
  | 'download-app';

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim().toLowerCase();
  }

  if (typeof error === 'string') {
    return error.trim().toLowerCase();
  }

  if (error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message.trim().toLowerCase();
  }

  return '';
}

function includesAny(message: string, patterns: string[]): boolean {
  return patterns.some((pattern) => message.includes(pattern));
}

function isNetworkIssue(message: string): boolean {
  return includesAny(message, [
    'network',
    'fetch',
    'timed out',
    'timeout',
    'connection',
    'socket',
    'offline',
    'internet',
    'dns',
    'temporarily unavailable',
  ]);
}

function isSessionIssue(message: string): boolean {
  return includesAny(message, [
    'not authenticated',
    'auth user not found',
    'user not found',
    'forbidden',
    'session',
    'expired',
    'unauthorized',
  ]);
}

function isUnavailableIssue(message: string): boolean {
  return includesAny(message, [
    'not found',
    'no longer available',
    'not available',
    'not active',
    'conversation not found',
    'listing not found',
    'profile not found',
    'message not found',
  ]);
}

export function getUserFlowErrorMessage(error: unknown, context: UserFlowErrorContext): string {
  const message = getRawErrorMessage(error);

  if (context === 'post-delete-signout') {
    return 'Your account was deleted, but we could not finish signing you out automatically. Close and reopen the app to clear your session.';
  }

  if (context === 'sign-out') {
    if (isSessionIssue(message)) {
      return 'Your session has already ended. Return to login if needed.';
    }
    if (isNetworkIssue(message)) {
      return 'We could not sign you out right now. Check your connection and try again.';
    }
    return 'We could not sign you out right now. Please try again.';
  }

  if (context === 'delete-account') {
    if (isSessionIssue(message)) {
      return 'Your session expired. Sign in again before deleting your account.';
    }
    if (isNetworkIssue(message)) {
      return 'We could not delete your account right now. Check your connection and try again.';
    }
    return 'We could not delete your account right now. Please try again.';
  }

  if (context === 'block-user' || context === 'unblock-user') {
    if (message.includes('you cannot block yourself')) {
      return 'You cannot block your own account.';
    }
    if (isUnavailableIssue(message)) {
      return 'This user is no longer available.';
    }
    if (isSessionIssue(message)) {
      return `Please sign in again before trying to ${context === 'block-user' ? 'block' : 'unblock'} this user.`;
    }
    if (isNetworkIssue(message)) {
      return `We could not ${context === 'block-user' ? 'block' : 'unblock'} this user right now. Check your connection and try again.`;
    }
    return `We could not ${context === 'block-user' ? 'block' : 'unblock'} this user right now. Please try again.`;
  }

  if (context === 'notifications-enable' || context === 'notifications-disable') {
    const actionLabel = context === 'notifications-enable' ? 'turn on' : 'turn off';
    if (isSessionIssue(message)) {
      return `Please sign in again before trying to ${actionLabel} notifications.`;
    }
    if (isNetworkIssue(message)) {
      return `We could not ${actionLabel} notifications right now. Check your connection and try again.`;
    }
    return `We could not ${actionLabel} notifications right now. Please try again.`;
  }

  if (context === 'prepare-profile-image') {
    if (message.includes('too large after compression')) {
      return 'That photo is still too large. Choose a smaller image and try again.';
    }
    if (message.includes('permission')) {
      return 'Please allow photo library access before choosing a profile picture.';
    }
    return 'We could not prepare that photo. Try a different image and try again.';
  }

  if (context === 'save-profile') {
    if (isSessionIssue(message)) {
      return 'Please sign in again before saving your profile.';
    }
    if (
      isNetworkIssue(message) ||
      includesAny(message, ['upload failed', 'upload response', 'storage id'])
    ) {
      return 'We could not save your profile right now. Check your connection and try again.';
    }
    return 'We could not save your profile right now. Please try again.';
  }

  if (context === 'send-first-message' || context === 'send-message') {
    if (
      context === 'send-first-message' &&
      includesAny(message, [
        'listing not found',
        'listing is not active',
        'listing is not available',
      ])
    ) {
      return 'This listing is no longer available.';
    }
    if (context === 'send-message' && message.includes('conversation not found')) {
      return 'This conversation is no longer available.';
    }
    if (message.includes("you can't message yourself")) {
      return 'You cannot message your own listing.';
    }
    if (message.includes('you cannot message this user')) {
      return 'You cannot message this user.';
    }
    if (message.includes('contains inappropriate content')) {
      return 'That message could not be sent. Edit it and try again.';
    }
    if (message.includes('message cannot be empty')) {
      return 'Enter a message before sending.';
    }
    if (message.includes('message must be')) {
      return 'That message is too long. Shorten it and try again.';
    }
    if (isSessionIssue(message)) {
      return 'Please sign in again and try sending that message one more time.';
    }
    if (isNetworkIssue(message)) {
      return context === 'send-first-message'
        ? 'We could not start this conversation right now. Check your connection and try again.'
        : 'We could not send your message right now. Check your connection and try again.';
    }
    return context === 'send-first-message'
      ? 'We could not start this conversation right now. Please try again.'
      : 'We could not send your message right now. Please try again.';
  }

  if (context === 'save-listing') {
    if (message.includes('listing not found')) {
      return 'This listing is no longer available.';
    }
    if (isSessionIssue(message)) {
      return 'Please sign in again before saving listings.';
    }
    if (isNetworkIssue(message)) {
      return 'We could not save this listing right now. Check your connection and try again.';
    }
    return 'We could not save this listing right now. Please try again.';
  }

  if (context === 'create-listing') {
    if (isSessionIssue(message)) {
      return 'Please sign in again before creating a listing.';
    }
    if (isNetworkIssue(message)) {
      return 'We could not create your listing right now. Check your connection and try again.';
    }
    return 'We could not create your listing right now. Please try again.';
  }

  if (context === 'update-listing') {
    if (
      includesAny(message, [
        'listing not found',
        'cannot update a sold listing',
        'cannot update a deleted listing',
      ])
    ) {
      return 'This listing can no longer be edited.';
    }
    if (isSessionIssue(message)) {
      return 'Please sign in again before updating this listing.';
    }
    if (isNetworkIssue(message)) {
      return 'We could not update this listing right now. Check your connection and try again.';
    }
    return 'We could not update this listing right now. Please try again.';
  }

  if (context === 'mark-listing-sold') {
    if (
      includesAny(message, [
        'listing not found',
        'cannot change status of a sold listing',
        'cannot change status of a deleted listing',
      ])
    ) {
      return 'This listing can no longer be updated.';
    }
    if (isSessionIssue(message)) {
      return 'Please sign in again before updating this listing.';
    }
    if (isNetworkIssue(message)) {
      return 'We could not mark this listing as sold right now. Check your connection and try again.';
    }
    return 'We could not mark this listing as sold right now. Please try again.';
  }

  if (context === 'submit-report') {
    if (message.includes('already reported')) {
      return 'You already reported this. Our team has it.';
    }
    if (message.includes('report limit reached')) {
      return 'You have reached the report limit for now. Try again later.';
    }
    if (message.includes('notes must be')) {
      return 'Your notes are too long. Shorten them and try again.';
    }
    if (message.includes('please provide details when selecting "other"')) {
      return 'Add a few details before submitting this report.';
    }
    if (isUnavailableIssue(message)) {
      return 'This content is no longer available to report.';
    }
    if (
      message.includes('forbidden') ||
      message.includes('you can only report messages from the other participant')
    ) {
      return 'You cannot report this content.';
    }
    if (isNetworkIssue(message)) {
      return 'We could not submit your report right now. Check your connection and try again.';
    }
    return 'We could not submit your report right now. Please try again.';
  }

  if (context === 'open-in-app') {
    return 'We could not open the app right now. Try again or use the download link below.';
  }

  if (context === 'download-app') {
    return 'We could not open the download link right now. Try again in a moment.';
  }

  return 'Something went wrong. Please try again.';
}
