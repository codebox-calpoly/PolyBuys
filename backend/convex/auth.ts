import { convexAuth } from '@convex-dev/auth/server';
import { AppReviewOTP } from './AppReviewOTP';
import { ResendOTP } from './ResendOTP';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP, AppReviewOTP],
});
