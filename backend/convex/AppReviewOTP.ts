import { Email } from '@convex-dev/auth/providers/Email';
import type { RandomReader } from '@oslojs/crypto/random';
import { generateRandomString } from '@oslojs/crypto/random';
import { ConvexError } from 'convex/values';

const IOS_REVIEW_EMAIL = (process.env.AUTH_APP_REVIEW_EMAIL ?? '').toLowerCase().trim();
const IOS_REVIEW_CODE = (process.env.AUTH_APP_REVIEW_CODE ?? '').trim();
const REVIEW_CODE_REGEX = /^\d{8}$/;

function isAppReviewOtpEnabled(): boolean {
  return IOS_REVIEW_EMAIL.length > 0 && REVIEW_CODE_REGEX.test(IOS_REVIEW_CODE);
}

export const AppReviewOTP = Email({
  id: 'ios-review-otp',
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    if (isAppReviewOtpEnabled()) {
      // Intentionally fixed for Apple App Review account.
      return IOS_REVIEW_CODE;
    }
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, '0123456789', 8);
  },
  async sendVerificationRequest({ identifier }) {
    if (!isAppReviewOtpEnabled() || identifier.toLowerCase().trim() !== IOS_REVIEW_EMAIL) {
      throw new ConvexError('Email must be a @calpoly.edu address');
    }
    // No-op: the app review code is predetermined and provided manually.
  },
});
