'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';
import { api } from './_generated/api';

/**
 * Generate a 6-digit verification code
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification email and store token
 * This is an action because it needs to call external APIs (SendGrid)
 */
export const sendVerificationEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const email = args.email.toLowerCase().trim();
    const token = generateVerificationCode();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Store the token in the database
    await ctx.runMutation(api.verification.storeVerificationToken, {
      email,
      token,
      expiresAt,
    });

    // Only send email if SendGrid is configured
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.log(`[DEV MODE] Verification code for ${email}: ${token}`);
      console.log('Set SENDGRID_API_KEY to send actual emails');
      return;
    }

    // Dynamic import to avoid issues when SendGrid is not configured
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(apiKey);

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@polybuys.app';
    const appUrl = process.env.APP_URL || 'https://polybuys.app';
    const verificationLink = `${appUrl}/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Verify your PolyBuys account',
      text: `Welcome to PolyBuys! Please verify your Cal Poly email address.\n\nYour verification code: ${token}\n\nOr click this link: ${verificationLink}\n\nThis code will expire in 24 hours.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f4e3d;">Welcome to PolyBuys!</h2>
          <p>Please verify your Cal Poly email address to complete your account setup.</p>
          <p style="margin: 20px 0;">
            <a href="${verificationLink}" style="background-color: #1f4e3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Verify Email Address
            </a>
          </p>
          <p>Or enter this verification code:</p>
          <p style="font-size: 24px; font-weight: bold; color: #1f4e3d; letter-spacing: 4px; margin: 20px 0;">
            ${token}
          </p>
          <p style="color: #666; font-size: 12px;">
            This code will expire in 24 hours. If you didn't create a PolyBuys account, please ignore this email.
          </p>
        </div>
      `,
    };

    try {
      await sgMail.default.send(msg);
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email. Please try again later.');
    }
  },
});

/**
 * Resend verification email
 */
export const resendVerificationEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Delete any existing token for this email first
    await ctx.runMutation(api.verification.deleteVerificationToken, {
      email: args.email.toLowerCase().trim(),
    });

    // Send new verification email
    await ctx.runAction(api.emailActions.sendVerificationEmail, {
      email: args.email,
    });
  },
});
