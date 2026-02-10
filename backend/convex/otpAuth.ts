import { mutation, action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { v, ConvexError } from 'convex/values';
import { hashOTP, verifyOTPHash } from './crypto';
import { Resend } from 'resend';

/**
 * Internal mutation to atomically check rate limit and store OTP
 * This prevents race conditions in concurrent OTP requests
 */
export const createAndStoreOTPInternal = internalMutation({
  args: {
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Check rate limit (3 per hour per email)
    const oneHourAgo = Date.now() - 3600000;
    const recentRequests = await ctx.db
      .query('otpCodes')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .filter((q) => q.gt(q.field('createdAt'), oneHourAgo))
      .collect();

    if (recentRequests.length >= 3) {
      throw new ConvexError('Too many requests. Please try again later.');
    }

    // Store OTP atomically in same transaction
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
 * Generate a cryptographically secure 6-digit OTP
 * Uses Web Crypto API for secure random number generation
 */
function generateSecureOTP(): string {
  // Generate a random number between 100000 and 999999
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Use modulo to get a number in our range
  const randomNum = (array[0] % 900000) + 100000;
  return randomNum.toString();
}

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

    // 2. Generate cryptographically secure 6-digit OTP
    const otp = generateSecureOTP();

    // 3. Hash the OTP
    const codeHash = await hashOTP(otp);

    // 4. Atomically check rate limit and store OTP
    await ctx.runMutation(internal.otpAuth.createAndStoreOTPInternal, {
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
