import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { Resend } from 'resend';

/**
 * Internal action to send OTP verification emails via Resend
 * Called by requestOTP mutation via scheduler
 */
export const sendOTP = internalAction({
  args: {
    email: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.AUTH_RESEND_KEY;

    if (!apiKey) {
      console.error('AUTH_RESEND_KEY not configured');
      throw new Error('Email service not configured');
    }

    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: 'PolyBuys <noreply@polybuys.com>',
      to: args.email,
      subject: 'Your PolyBuys verification code',
      text: `Your verification code is: ${args.otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #154734; margin-bottom: 24px; font-size: 24px;">PolyBuys</h1>
          <p style="color: #333; font-size: 16px; margin-bottom: 24px;">
            Your verification code is:
          </p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #154734;">
              ${args.otp}
            </span>
          </div>
          <p style="color: #666; font-size: 14px; margin-bottom: 8px;">
            This code expires in 10 minutes.
          </p>
          <p style="color: #999; font-size: 12px;">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send verification email');
    }
  },
});
