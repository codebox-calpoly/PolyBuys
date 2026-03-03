# PolyBuys Decision Record

Last updated: 2026-03-03

## Product & Policy Decisions

- **Access policy:** Cal Poly email requirement is mandatory.
- **Moderation policy:** fail-open (if moderation provider is unavailable, core flows continue).
- **Fail-open control:** degraded moderation events enqueue shadow re-checks with retry + alerting.
- **Reporting policy:** auto-hide content at 3 unique reporter threshold.
- **Demo scope:** full marketplace demo includes listings, messaging, reports, shareable links, and deep linking.

## Engineering Process Decisions

- Merge **small/clean PRs first**.
- If a PR is stale/conflicted/low quality: **rebuild as clean branch from `dev`**.
- CI quality gates run on **all pull requests** (not only PRs targeting `main`/`dev`) to avoid blind spots on integration/staging branches.
- Require quality gates before merge recommendations:
  - lint
  - frontend/backend typecheck
  - prettier check
  - full tests

## Messaging Data Model Decisions (#44)

- **Message type model:** strict minimal enum direction for now: `text`, `system`.
- **Attachments:** image/file messaging deferred to a later dedicated pass.
- **Participants:** explicit participant IDs in conversation model.
- **Inbox snapshots:** keep last-message snapshot fields for fast inbox rendering.
- **Read/unread strategy:** optimize for fast inbox counts with precise message-state behavior.
- **Conversation ordering:** read acknowledgements do not bump conversation `updatedAt`; only message activity changes inbox order.
- **History loading:** message thread history uses cursor pagination (`messagesByConversationPaginated`) rather than fixed caps.
- **Migration strategy:** staged rollout + backfill/reconciliation, avoid hard cutovers.
- **Retention:** keep all messages for now.

## Scale & Reliability Decisions

- Add bounds for pagination and search inputs.
- Avoid unbounded reads/writes in hot paths and migrations.
- Use batched backfill for large-table migrations.
- Add upload timeout/error handling in image upload flow.
- Use `reports.by_reporter_createdAt` for report rate-limit checks to avoid large reporter-history scans.
- Use stable opaque cursors on manual listing pagination branches to reduce duplicate/skip behavior during concurrent writes.

## Deep Linking / Sharing Decisions

- Keep canonical listing URLs and short share links.
- Maintain iOS/Android association files for universal/app links.
- Keep listing route param validation in detail/edit pages to avoid invalid query shapes.

## Security / Abuse Posture (Current)

- Prioritize availability with fail-open moderation.
- Maintain reporting + moderation audit paths.
- Moderation audit stores hash + redacted preview (not raw text) with 30-day TTL cleanup.
- Legacy moderation rows without TTL are pruned using createdAt retention fallback.
- Degraded moderation now enqueues content into `shadowModerationQueue` for retries and emits `moderationAlerts`.
- Shadow queue should be processed by a periodic runner (`moderation:processShadowModerationQueue`) for retry drain.
- Add per-target daily report flood cap to reduce brigading pressure on a single item/profile.
- Continue hardening against abusive query/resource patterns and report brigading.

## Branching Notes

- Integration/test branch: `jaydon/nightly-clean-integration`
- Clean-branch strategy used to replace conflict-heavy PR implementations when necessary.
