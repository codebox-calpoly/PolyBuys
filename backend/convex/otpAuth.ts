import { mutation, action } from './_generated/server';
import { api } from './_generated/api';
import { v, ConvexError } from 'convex/values';
import { hashOTP, verifyOTPHash } from './crypto';
import { Resend } from 'resend';

/**
 * Internal mutation to store OTP in database
 */
export const storeOTP = mutation({
  args: {
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('otpCodes', {
      email: args.email,
      codeHash: args.codeHash,
      expiresAt: args.expiresAt,
      attempts: 0,
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal query to count recent OTP requests
 */
export const getRecentOTPCount = mutation({
  args: {
    email: v.string(),
    since: v.number(),
  },
  handler: async (ctx, args) => {
    const recentRequests = await ctx.db
      .query('otpCodes')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .filter((q) => q.gt(q.field('createdAt'), args.since))
      .collect();

    return recentRequests.length;
  },
});

/**
 * Request an OTP code for Cal Poly email authentication
 * Implements rate limiting (3 requests per hour) and generates 6-digit codes
 */
export const requestOTP = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validate Cal Poly email
    const email = args.email.toLowerCase().trim();
    if (!email.endsWith('@calpoly.edu')) {
      throw new ConvexError('Please use your Cal Poly email address');
    }

    // 2. Rate limit check (3 per hour per email)
    const oneHourAgo = Date.now() - 3600000;
    const recentCount = await ctx.runMutation(api.otpAuth.getRecentOTPCount, {
      email,
      since: oneHourAgo,
    });

    if (recentCount >= 3) {
      throw new ConvexError('Too many requests. Please try again later.');
    }

    // 3. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Hash and store OTP
    const codeHash = await hashOTP(otp);
    await ctx.runMutation(api.otpAuth.storeOTP, {
      email,
      codeHash,
      expiresAt: Date.now() + 600000, // 10 minutes
    });

    // 5. Send email via Resend
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      throw new ConvexError('Email service not configured');
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: 'PolyBuys <noreply@polybuys.com>',
      to: email,
      subject: 'Your PolyBuys verification code',
      text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #154734; margin-bottom: 24px; font-size: 24px;">PolyBuys</h1>
          <p style="color: #333; font-size: 16px; margin-bottom: 24px;">
            Your verification code is:
          </p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #154734;">
              ${otp}
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
      throw new ConvexError('Failed to send verification email');
    }

    return { success: true };
  },
});

/**
 * Verify an OTP code and create/return user on success
 * Implements attempt limiting (3 attempts per code)
 */
export const verifyOTP = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // 1. Find latest OTP for email
    const otpRecord = await ctx.db
      .query('otpCodes')
      .withIndex('by_email', (q) => q.eq('email', email))
      .order('desc')
      .first();

    if (!otpRecord) {
      throw new ConvexError('No verification code found. Please request a new one.');
    }

    // 2. Check expiration
    if (Date.now() > otpRecord.expiresAt) {
      throw new ConvexError('Code expired. Please request a new one.');
    }

    // 3. Check attempts
    if (otpRecord.attempts >= 3) {
      throw new ConvexError('Too many attempts. Please request a new code.');
    }

    // 4. Verify code
    const isValid = await verifyOTPHash(args.code, otpRecord.codeHash);

    if (!isValid) {
      // Increment attempts
      await ctx.db.patch(otpRecord._id, {
        attempts: otpRecord.attempts + 1,
      });
      throw new ConvexError('Invalid code. Please try again.');
    }

    // 5. Delete used OTP
    await ctx.db.delete(otpRecord._id);

    // 6. Create or get user
    let user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (!user) {
      // Create new user
      const userId = await ctx.db.insert('users', {
        email,
        name: null,
        emailVerified: true,
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    } else {
      // Update existing user to mark email as verified
      await ctx.db.patch(user._id, {
        emailVerified: true,
      });
      user = await ctx.db.get(user._id);
    }

    // 7. Return user data for client-side session
    return {
      userId: user!._id,
      email: user!.email,
    };
  },
});
