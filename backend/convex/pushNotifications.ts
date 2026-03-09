import { ConvexError, v } from 'convex/values';
import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { components } from './_generated/api';
import { internalMutation, mutation } from './_generated/server';

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('Unauthorized');
    }

    const token = normalizePushToken(args.token);
    if (token.length === 0) {
      throw new ConvexError('Push token cannot be empty');
    }

    await pushNotifications.recordToken(ctx, {
      userId: identity.subject,
      pushToken: token,
    });

    return { ok: true };
  },
});

export const removePushToken = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError('Unauthorized');
    }

    await pushNotifications.removeToken(ctx, { userId: identity.subject });
    return { ok: true };
  },
});

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

    const pushId = await pushNotifications.sendPushNotification(ctx, {
      userId: args.recipientId,
      allowUnregisteredTokens: true,
      notification: {
        title: 'New message',
        body: toMessagePreview(args.body),
        data: {
          type: 'new_message',
          conversationId: args.conversationId,
          listingId: args.listingId,
          messageId: args.messageId,
          senderId: args.senderId,
        },
      },
    });

    return { pushId };
  },
});
