import { ConvexError } from 'convex/values';

/** User-facing display for an error (e.g. for Alert.alert(title, message)) */
export type ConvexErrorDisplay = { title: string; message: string };

/** Generic fallback message; never show raw backend/internal details to users */
const GENERIC_MESSAGE =
  'Something went wrong. Please try again. If it keeps happening, try signing out and back in.';

/**
 * Maps known backend ConvexError messages to safe, user-friendly text.
 * Add entries here as we discover backend messages that are safe to show or need rewording.
 */
const USER_MESSAGE_MAP: Record<string, string> = {
  // Auth / session
  'You must be logged in to perform this action': 'Please sign in and try again.',
  'You must be logged in': 'Please sign in and try again.',
  'You must be logged in to create a profile': 'Please sign in and try again.',
  'You must be logged in to upload images': 'Please sign in and try again.',
  'You must be logged in to report content': 'Please sign in and try again.',
  'You must be logged in to view your hidden listings': 'Please sign in and try again.',
  'You must be logged in to view your listings': 'Please sign in and try again.',
  Unauthorized: 'Please sign in and try again.',
  'Not authenticated': 'Please sign in and try again.',
  Forbidden: "You don't have permission to do that.",
  // Profile
  'Profile already exists for this user': 'A profile already exists for this account.',
  'Profile not found': 'Profile not found.',
  'Email is required to create a profile': 'Email is required.',
  'Please provide a valid email address': 'Please provide a valid email address.',
  'Join date must be a valid timestamp': 'Invalid profile data. Please try again.',
  'Review count must be a non-negative integer': 'Invalid profile data. Please try again.',
  'Hidden timestamp must be a valid timestamp': 'Invalid profile data. Please try again.',
  'No valid fields to update': 'Nothing to update.',
  // Listings
  'Listing not found': 'That listing could not be found.',
  'You are not the owner of this listing': "You can't edit this listing.",
  'Cannot update a deleted listing': 'That listing has been deleted.',
  'Cannot change status of a deleted listing': 'That listing has been deleted.',
  'You must complete your profile setup before creating a listing':
    'Please complete your profile in Settings before creating a listing.',
  'Listing is not active': 'That listing is no longer available.',
  'Listing is not available': 'That listing is no longer available.',
  "You can't message yourself": "You can't start a conversation with yourself.",
  // Moderation (keep user-friendly wording)
  'violates our community guidelines':
    'Some content was flagged by our safety checks. Try rewording and submit again.',
  'Your message was not sent because it contains inappropriate content.':
    'Your message was not sent because it contains content that goes against our guidelines. Please reword and try again.',
  // Reports
  'You have already reported this content':
    "You've already reported this. Our team will review it.",
  'Report limit reached. Please try again later.': 'Report limit reached. Please try again later.',
  'Notes must be 500 characters or less': 'Notes must be 500 characters or less.',
  // Messages / conversations
  'Conversation not found': 'Conversation not found. It may have been removed.',
  'Message cannot be empty': 'Please enter a message.',
  'Message must be': 'Message is too long. Please shorten it.',
  'Bio must be': 'Bio is too long. Please shorten it.',
  'Notes must be': 'Notes are too long. Please shorten them.',
  // Push / upload (generic)
  'Push token cannot be empty': 'Notification setup failed. Please try again.',
  'Email service not configured. Please contact support.':
    'Email is not set up. Please contact support.',
  'Failed to send verification email. Please try again.':
    'We couldn’t send the verification email. Please try again.',
  'Email must be a @calpoly.edu address': 'Please use your @calpoly.edu email.',
};

/** Check if a backend message is in our safe-to-show map (exact or includes key) */
function getMappedMessage(raw: string): string | null {
  const trimmed = raw.trim();
  if (USER_MESSAGE_MAP[trimmed]) {
    return USER_MESSAGE_MAP[trimmed];
  }
  for (const [key, value] of Object.entries(USER_MESSAGE_MAP)) {
    if (trimmed.includes(key)) {
      return value;
    }
  }
  return null;
}

/**
 * Extracts a safe, user-facing title and message from a Convex/request error.
 * Logs the raw error for developers; never exposes internal details to the UI.
 */
export function getConvexErrorDisplay(error: unknown, fallbackTitle: string): ConvexErrorDisplay {
  let rawMessage: string;

  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === 'string') {
      rawMessage = data;
    } else if (
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
    ) {
      rawMessage = (data as { message: string }).message;
    } else {
      rawMessage = 'Request failed';
    }
  } else if (error instanceof Error) {
    rawMessage = error.message;
  } else {
    rawMessage = 'Unknown error';
  }

  if (__DEV__) {
    console.error('[Convex error]', fallbackTitle, error);
  }

  const mapped = getMappedMessage(rawMessage);
  const message = mapped ?? GENERIC_MESSAGE;

  return {
    title: fallbackTitle,
    message,
  };
}
