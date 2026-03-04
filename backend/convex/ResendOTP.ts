import { Email } from '@convex-dev/auth/providers/Email';
import { Resend as ResendAPI } from 'resend';
import type { RandomReader } from '@oslojs/crypto/random';
import { generateRandomString } from '@oslojs/crypto/random';
import { isCalPolyEmail } from '@polybuys/shared';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';

/**
 * Resend OTP Email Provider for Cal Poly authentication
 * Sends an 8-digit verification code that expires in 15 minutes
 */
const resendFromAddress = process.env.AUTH_RESEND_FROM ?? process.env.RESEND_FROM;
const OTP_SEND_RATE_LIMIT = {
  WINDOW_MS: 10 * 60 * 1000,
  EMAIL_WINDOW_MAX: 5,
  IDENTITY_WINDOW_MAX: 10,
  DAY_MS: 24 * 60 * 60 * 1000,
  EMAIL_DAY_MAX: 20,
  IDENTITY_DAY_MAX: 40,
} as const;

type OtpProviderActionCtx = {
  auth: {
    getUserIdentity: () => Promise<{ subject: string } | null>;
  };
  runMutation: (mutationRef: unknown, args: unknown) => Promise<unknown>;
};
type SendVerificationRequestParams = {
  identifier: string;
  provider: {
    apiKey?: string;
  };
  token: string;
  url?: string;
  request?: unknown;
};

function normalizeOtpEmail(email: string) {
  return email.trim().toLowerCase();
}

function isOtpProviderActionCtx(value: unknown): value is OtpProviderActionCtx {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybeCtx = value as {
    auth?: { getUserIdentity?: unknown };
    runMutation?: unknown;
  };
  return (
    !!maybeCtx.auth &&
    typeof maybeCtx.auth === 'object' &&
    typeof maybeCtx.auth.getUserIdentity === 'function' &&
    typeof maybeCtx.runMutation === 'function'
  );
}

function isAuthJsSendVerificationShape(value: unknown): value is SendVerificationRequestParams {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybeParams = value as {
    identifier?: unknown;
    token?: unknown;
    url?: unknown;
    request?: unknown;
  };
  const hasRequestObject =
    typeof Request === 'undefined'
      ? maybeParams.request !== undefined
      : maybeParams.request instanceof Request;
  return (
    typeof maybeParams.identifier === 'string' &&
    typeof maybeParams.token === 'string' &&
    typeof maybeParams.url === 'string' &&
    hasRequestObject
  );
}

export const enforceOtpSendRateLimit = internalMutation({
  args: {
    email: v.string(),
    identityKey: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedEmail = normalizeOtpEmail(args.email);

    const [emailWindow, identityWindow, emailDay, identityDay] = await Promise.all([
      ctx.db
        .query('otpSendEvents')
        .withIndex('by_email_type_createdAt', (q) =>
          q
            .eq('email', normalizedEmail)
            .eq('eventType', 'issued')
            .gt('createdAt', now - OTP_SEND_RATE_LIMIT.WINDOW_MS)
        )
        .take(OTP_SEND_RATE_LIMIT.EMAIL_WINDOW_MAX + 1),
      ctx.db
        .query('otpSendEvents')
        .withIndex('by_identity_type_createdAt', (q) =>
          q
            .eq('identityKey', args.identityKey)
            .eq('eventType', 'issued')
            .gt('createdAt', now - OTP_SEND_RATE_LIMIT.WINDOW_MS)
        )
        .take(OTP_SEND_RATE_LIMIT.IDENTITY_WINDOW_MAX + 1),
      ctx.db
        .query('otpSendEvents')
        .withIndex('by_email_type_createdAt', (q) =>
          q
            .eq('email', normalizedEmail)
            .eq('eventType', 'issued')
            .gt('createdAt', now - OTP_SEND_RATE_LIMIT.DAY_MS)
        )
        .take(OTP_SEND_RATE_LIMIT.EMAIL_DAY_MAX + 1),
      ctx.db
        .query('otpSendEvents')
        .withIndex('by_identity_type_createdAt', (q) =>
          q
            .eq('identityKey', args.identityKey)
            .eq('eventType', 'issued')
            .gt('createdAt', now - OTP_SEND_RATE_LIMIT.DAY_MS)
        )
        .take(OTP_SEND_RATE_LIMIT.IDENTITY_DAY_MAX + 1),
    ]);

    if (emailWindow.length >= OTP_SEND_RATE_LIMIT.EMAIL_WINDOW_MAX) {
      await ctx.db.insert('otpSendEvents', {
        email: normalizedEmail,
        identityKey: args.identityKey,
        eventType: 'blocked',
        reason: 'email_rate_limit_10m',
        createdAt: now,
      });
      throw new ConvexError(
        'Too many verification requests. Please wait a few minutes and try again.'
      );
    }

    if (identityWindow.length >= OTP_SEND_RATE_LIMIT.IDENTITY_WINDOW_MAX) {
      await ctx.db.insert('otpSendEvents', {
        email: normalizedEmail,
        identityKey: args.identityKey,
        eventType: 'blocked',
        reason: 'identity_rate_limit_10m',
        createdAt: now,
      });
      throw new ConvexError(
        'Too many verification requests. Please wait a few minutes and try again.'
      );
    }

    if (emailDay.length >= OTP_SEND_RATE_LIMIT.EMAIL_DAY_MAX) {
      await ctx.db.insert('otpSendEvents', {
        email: normalizedEmail,
        identityKey: args.identityKey,
        eventType: 'blocked',
        reason: 'email_rate_limit_day',
        createdAt: now,
      });
      throw new ConvexError('Daily verification request limit reached. Please try again tomorrow.');
    }

    if (identityDay.length >= OTP_SEND_RATE_LIMIT.IDENTITY_DAY_MAX) {
      await ctx.db.insert('otpSendEvents', {
        email: normalizedEmail,
        identityKey: args.identityKey,
        eventType: 'blocked',
        reason: 'identity_rate_limit_day',
        createdAt: now,
      });
      throw new ConvexError('Daily verification request limit reached. Please try again tomorrow.');
    }

    await ctx.db.insert('otpSendEvents', {
      email: normalizedEmail,
      identityKey: args.identityKey,
      eventType: 'issued',
      createdAt: now,
    });
  },
});

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

  async sendVerificationRequest(params: SendVerificationRequestParams, ...rest: unknown[]) {
    const { identifier: email, provider, token } = params;
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

    const normalizedEmail = normalizeOtpEmail(email);

    // Validate Cal Poly email domain
    if (!isCalPolyEmail(normalizedEmail)) {
      throw new ConvexError('Email must be a @calpoly.edu address');
    }

    const actionCtxCandidate = rest[0];
    if (isOtpProviderActionCtx(actionCtxCandidate)) {
      const actionCtx = actionCtxCandidate;
      const identity = await actionCtx.auth.getUserIdentity();
      // Convex provider callbacks do not expose client IP; use authenticated user id
      // when available, otherwise fall back to the normalized destination email.
      const identityKey = identity?.subject
        ? `user:${identity.subject}`
        : `email:${normalizedEmail}`;
      await actionCtx.runMutation(internal.ResendOTP.enforceOtpSendRateLimit, {
        email: normalizedEmail,
        identityKey,
      });
    } else if (isAuthJsSendVerificationShape(params)) {
      // Never bypass abuse controls: if the callback shape is Auth.js-style but
      // we cannot access Convex mutation context, fail closed.
      const errorRef = `otp_ctx_${Date.now().toString(36)}`;
      console.error('Resend OTP rate-limit enforcement unavailable', { errorRef });
      throw new ConvexError('Failed to send verification email. Please try again.');
    } else {
      const errorRef = `otp_ctx_${Date.now().toString(36)}`;
      console.error('Resend OTP callback context is unsupported', { errorRef });
      throw new ConvexError('Failed to send verification email. Please try again.');
    }

    const resend = new ResendAPI(provider.apiKey);

    const { error } = await resend.emails.send({
      from: resendFromAddress,
      to: [normalizedEmail],
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
      const upstreamStatus =
        (error as { statusCode?: number; statusCodeNumber?: number }).statusCode ??
        (error as { statusCodeNumber?: number }).statusCodeNumber;
      const errorName = (error as { name?: string }).name ?? 'UnknownResendError';
      const errorRef = `otp_${Date.now().toString(36)}`;
      console.error('Resend OTP send failed', {
        errorRef,
        errorName,
        upstreamStatus,
      });
      throw new ConvexError('Failed to send verification email. Please try again.');
    }
  },
});
