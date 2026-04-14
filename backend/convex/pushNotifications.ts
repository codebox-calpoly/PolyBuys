import { ConvexError, v } from 'convex/values';
import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { components } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { requireAuthUserId } from './lib/authIdentity';

const pushNotifications = new PushNotifications<string>(components.pushNotifications);

function normalizePushToken(token: string) {
  return token.trim();
}

function toMessagePreview(body: string) {
  const normalized = body.trim();
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
}

export const recordPushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const token = normalizePushToken(args.token);
    if (token.length === 0) {
      throw new ConvexError('Push token cannot be empty');
    }

    await pushNotifications.recordToken(ctx, {
      userId,
      pushToken: token,
    });

    return { ok: true };
  },
});

export const removePushToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    await pushNotifications.removeToken(ctx, { userId });
    return { ok: true };
  },
});

function displayNameFromProfileAndUser(
  profile: { name?: string } | null,
  user: { name?: string } | null
): string {
  const userName = user?.name?.trim();
  if (userName && userName.length > 0) return userName;
  const profileName = profile?.name?.trim();
  if (profileName && profileName.length > 0) return profileName;
  return 'Someone';
}

export const sendNewMessageNotification = internalMutation({
  args: {
    recipientId: v.string(),
    senderId: v.string(),
    conversationId: v.id('conversations'),
    listingId: v.id('listings'),
    messageId: v.id('messages'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.recipientId === args.senderId) {
      return { pushId: null };
    }

    const recipientUser = await ctx.db.get(args.recipientId as Id<'users'>);
    if (recipientUser?.messageNotificationsEnabled === false) {
      return { pushId: null };
    }

    const [senderProfile, senderUser] = await Promise.all([
      ctx.db
        .query('profiles')
        .withIndex('by_userId', (q) => q.eq('userId', args.senderId))
        .first(),
      ctx.db.get(args.senderId as Id<'users'>),
    ]);

    const senderName = displayNameFromProfileAndUser(senderProfile, senderUser);
    const messagePreview = toMessagePreview(args.body);

    const pushId = await pushNotifications.sendPushNotification(ctx, {
      userId: args.recipientId,
      allowUnregisteredTokens: true,
      notification: {
        title: senderName,
        body: messagePreview,
        data: {
          type: 'new_message',
          conversationId: args.conversationId,
          listingId: args.listingId,
          messageId: args.messageId,
          senderId: args.senderId,
          senderName,
        },
      },
    });

    return { pushId };
  },
});
