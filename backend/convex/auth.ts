/**
 * Custom OTP-based authentication for Cal Poly email validation
 *
 * This file replaces the previous @convex-dev/auth implementation.
 * The OTP authentication flow is handled by:
 * - otpAuth.ts: requestOTP and verifyOTP mutations
 * - email.ts: Resend email sending
 * - crypto.ts: OTP hashing utilities
 *
 * Frontend integration will need to:
 * 1. Call api.otpAuth.requestOTP({ email }) to request OTP
 * 2. Call api.otpAuth.verifyOTP({ email, code }) to verify and get userId
 * 3. Manage session state client-side
 */

export const AUTH_VERSION = '2.0.0-custom-otp';
