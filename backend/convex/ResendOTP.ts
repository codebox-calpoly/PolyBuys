import { Email } from '@convex-dev/auth/providers/Email';
import { Resend as ResendAPI } from 'resend';
import type { RandomReader } from '@oslojs/crypto/random';
import { generateRandomString } from '@oslojs/crypto/random';
import { isCalPolyEmail } from '@polybuys/shared';
import { ConvexError } from 'convex/values';

/**
 * Resend OTP Email Provider for Cal Poly authentication
 * Sends an 8-digit verification code that expires in 15 minutes
 */
const resendFromAddress = process.env.AUTH_RESEND_FROM ?? process.env.RESEND_FROM;

export const ResendOTP = Email({
  id: 'resend-otp',
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15, // 15 minutes

  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = '0123456789';
    const length = 8;
    return generateRandomString(random, alphabet, length);
  },

  async sendVerificationRequest({ identifier: email, provider, token }) {
    // Validate API key is configured
    if (!provider.apiKey) {
      throw new ConvexError('Email service not configured. Please contact support.');
    }

    // Validate sender is configured to a verified domain address in Resend
    if (!resendFromAddress) {
      throw new ConvexError(
        'Email sender not configured. Set AUTH_RESEND_FROM in Convex env to a verified sender address.'
      );
    }

    if (resendFromAddress.toLowerCase().includes('onboarding@resend.dev')) {
      throw new ConvexError(
        'Email sender is still set to Resend test mode. Use AUTH_RESEND_FROM with your verified domain (for example: PolyBuys <noreply@polybuys.com>).'
      );
    }

    // Validate Cal Poly email domain
    if (!isCalPolyEmail(email)) {
      throw new ConvexError('Email must be a @calpoly.edu address');
    }

    const resend = new ResendAPI(provider.apiKey);

    const { error } = await resend.emails.send({
      from: resendFromAddress,
      to: [email],
      subject: 'Your PolyBuys verification code',
      text: `Your verification code is: ${token}

This code will expire in 15 minutes.

If you didn't request this code, you can safely ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #154734; margin-bottom: 24px; font-size: 24px;">PolyBuys</h1>
          <p style="color: #333; font-size: 16px; margin-bottom: 24px;">
            Your verification code is:
          </p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #154734;">
              ${token}
            </span>
          </div>
          <p style="color: #666; font-size: 14px; margin-bottom: 8px;">
            This code will expire in 15 minutes.
          </p>
          <p style="color: #999; font-size: 12px;">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API error:', JSON.stringify(error, null, 2));
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        statusCode: (error as { statusCode?: number }).statusCode,
      });
      throw new ConvexError(
        `Failed to send verification email: ${error.message || 'Unknown error'}. Please try again.`
      );
    }
  },
});
