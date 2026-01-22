import { convexAuth } from '@convex-dev/auth/server';
import { ResendOTP } from './ResendOTP';

/**
 * Convex Auth configuration with Resend OTP provider
 * Users sign in with their @calpoly.edu email and receive a verification code
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP],
});
