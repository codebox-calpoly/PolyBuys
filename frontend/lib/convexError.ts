import { ConvexError } from 'convex/values';

/** User-facing display for an error (title + message for inline UI) */
export type ConvexErrorDisplay = { title: string; message: string };

/** Only for non-Convex or internal errors; never show raw internal details */
const GENERIC_MESSAGE =
  'Something went wrong. Please try again. If it keeps happening, try signing out and back in.';

/** Backend phrases we never show (internal/jargon); use generic instead */
const INTERNAL_PHRASES = [
  'Auth user not found',
  'numItems must be',
  'spawn ',
  'ENOENT',
  'ECONNREFUSED',
];

/** Only reword jargon; most backend messages are shown as-is so users see exactly why it failed */
const REWORD_MAP: Record<string, string> = {
  Unauthorized: 'You must be signed in to do that.',
  'Not authenticated': 'You must be signed in to do that.',
  Forbidden: "You don't have permission to do that.",
};

function isInternalMessage(raw: string): boolean {
  const lower = raw.toLowerCase();
  return INTERNAL_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()));
}

/**
 * Extracts a direct, user-facing message from a Convex/request error.
 * Prefers the backend message so users see exactly why it failed; only falls back to generic for internal/technical errors.
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

  const trimmed = rawMessage.trim();
  if (REWORD_MAP[trimmed]) {
    return { title: fallbackTitle, message: REWORD_MAP[trimmed] };
  }
  if (isInternalMessage(trimmed)) {
    return { title: fallbackTitle, message: GENERIC_MESSAGE };
  }
  if (error instanceof ConvexError && trimmed.length > 0) {
    return { title: fallbackTitle, message: trimmed };
  }
  return { title: fallbackTitle, message: GENERIC_MESSAGE };
}
