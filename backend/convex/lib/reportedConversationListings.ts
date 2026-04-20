import type { QueryCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

export async function getReportedConversationListingIdSetByReporter(
  ctx: QueryCtx,
  reporterId: Id<'users'>
): Promise<Set<Id<'listings'>>> {
  const reports = await ctx.db
    .query('reports')
    .withIndex('by_reporter', (q) => q.eq('reporterId', reporterId))
    .collect();

  const reportedConversationIdSet = new Set<Id<'conversations'>>();
  for (const report of reports) {
    if (report.targetType !== 'conversation') {
      continue;
    }
    const normalizedConversationId = await ctx.db.normalizeId('conversations', report.targetId);
    if (normalizedConversationId) {
      reportedConversationIdSet.add(normalizedConversationId);
    }
  }

  if (reportedConversationIdSet.size === 0) {
    return new Set<Id<'listings'>>();
  }

  const conversations = await Promise.all(
    [...reportedConversationIdSet].map((conversationId) => ctx.db.get(conversationId))
  );

  const listingIdSet = new Set<Id<'listings'>>();
  for (const conversation of conversations) {
    if (conversation) {
      listingIdSet.add(conversation.listingId);
    }
  }

  return listingIdSet;
}
