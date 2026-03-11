import { Email } from '@convex-dev/auth/providers/Email';
import { ConvexError } from 'convex/values';

const IOS_REVIEW_EMAIL = 'ios@polybuys.com';
const IOS_REVIEW_CODE = '31415926';

export const AppReviewOTP = Email({
  id: 'ios-review-otp',
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    // Intentionally fixed for Apple App Review account.
    return IOS_REVIEW_CODE;
  },
  async sendVerificationRequest({ identifier }) {
    if (identifier.toLowerCase().trim() !== IOS_REVIEW_EMAIL) {
      throw new ConvexError('Email must be a @calpoly.edu address');
    }
    // No-op: the app review code is predetermined and provided manually.
  },
});
