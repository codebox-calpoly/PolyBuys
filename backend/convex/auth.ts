import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';
import { ConvexError } from 'convex/values';
import { isCalPolyEmail } from '@polybuys/shared';
import { sendVerificationEmail } from './emailService';

/**
 * Email verification provider using SendGrid
 */
const emailVerificationProvider = {
  id: 'email-verification',
  async sendVerificationRequest({
    identifier: email,
    token,
  }: {
    identifier: string;
    token: string;
  }) {
    await sendVerificationEmail(email, token);
  },
};

/**
 * Convex Auth configuration with Password provider
 * Enforces @calpoly.edu email domain and email verification
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      verify: emailVerificationProvider,
      profile(params) {
        const email = (params.email as string)?.toLowerCase().trim();
        const name = params.name as string | undefined;

        // Validate Cal Poly email domain
        if (!email || !isCalPolyEmail(email)) {
          throw new ConvexError('Email must be a @calpoly.edu address');
        }

        // Validate password requirements
        const password = params.password as string;
        if (!password || password.length < 8) {
          throw new ConvexError('Password must be at least 8 characters');
        }

        return {
          email,
          name: name || null,
        };
      },
      validatePasswordRequirements(password: string) {
        if (password.length < 8) {
          throw new ConvexError('Password must be at least 8 characters');
        }
        // Optionally add more password requirements
        // e.g., require uppercase, lowercase, numbers, etc.
      },
    }),
  ],
});
