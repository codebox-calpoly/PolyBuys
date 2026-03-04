# PolyBuys Decision Record

Last updated: 2026-03-03

## Product & Policy Decisions

- **Access policy:** Cal Poly email requirement is mandatory.
- **Access enforcement:** backend profile creation validates `@calpoly.edu` identity email before persistence.
- **Moderation policy:** fail-open (if moderation provider is unavailable, core flows continue).
- **Fail-open control:** degraded moderation events enqueue shadow re-checks with retry + alerting.
- **Reporting policy:** auto-hide content at 3 qualified unique reporters. A report counts toward the 3-report threshold only when the reporter has a visible profile linked to a `@calpoly.edu` email, the profile is at least 1 hour old, the report passes per-reporter rate limits, and the reporter is not de-duplicated as a related account (canonical email key, including plus-alias collapse).
- **Reporting exceptions/appeals workflow (example):** when auto-hide triggers, keep content hidden and open a moderator review task with report metadata; if review finds brigading/false positives, unhide content and dismiss invalid reports; if review confirms policy violations, keep hidden and record enforcement rationale; sellers can appeal once, and appeal review is handled by a different moderator than the initial reviewer.
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
- **Message input validation:** message writes trim whitespace and reject blank content.
- **Attachments:** image/file messaging deferred to a later dedicated pass.
- **Participants:** explicit participant IDs in conversation model.
- **Conversation payload contract:** inbox counterpart image field is `avatarStorageId` (storage id), not a resolved URL.
- **Inbox snapshots:** keep last-message snapshot fields for fast inbox rendering.
- **Read/unread strategy:** optimize for fast inbox counts with precise message-state behavior.
- **Conversation ordering:** read acknowledgements do not bump conversation `updatedAt`; only message activity changes inbox order.
- **History loading:** message thread history uses cursor pagination (`messagesByConversationPaginated`) rather than fixed caps.
- **Conversation idempotency:** use deterministic `conversationKey` (`listingId|buyerId|sellerId`, encoded) plus tuple reconciliation to reduce duplicate creation under concurrent `getOrCreateConversation` calls.
- **Migration strategy:** staged rollout + backfill/reconciliation, avoid hard cutovers.
- **Retention:** keep all messages for now.

## Scale & Reliability Decisions

- Add bounds for pagination and search inputs.
- Add explicit bounds for `profiles.getProfiles` pagination (`1..100`) with cursor-format validation.
- Avoid unbounded reads/writes in hot paths and migrations.
- Use batched backfill for large-table migrations.
- Add upload timeout/error handling in image upload flow.
- Use `reports.by_reporter_createdAt` for report rate-limit checks to avoid large reporter-history scans.
- Use stable opaque cursors on manual listing pagination branches to reduce duplicate/skip behavior during concurrent writes.
- Replace post-filter listing `take(MAX_COLLECT)` truncation with bounded scan pagination (`scan1` cursors, 5k scan ceiling) for filter paths that cannot be fully index-native.
- Reconcile duplicate conversations in `getOrCreateConversation` by canonicalizing oldest tuple/key match and deleting only empty duplicates.
- Use adaptive overfetch windows for compound timestamp-id cursor paths to reduce pagination miss risk under high same-timestamp write bursts.

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
- Shadow queue drains automatically via Convex cron (2-minute interval) running `moderation:processShadowModerationQueue`.
- Add per-target daily report flood cap to reduce brigading pressure on a single item/profile.
- Add per-conversation rapid-send throttle to reduce message flooding bursts.
- Add per-user listing image upload rate limits (30 / 15 minutes, 120 / day) with telemetry in `imageUploadEvents`.
- Add per-user profile picture upload rate limits (30 / 15 minutes, 120 / day) with telemetry in `profileImageUploadEvents`.
- Add OTP verification-email send rate limits with telemetry (`otpSendEvents`) scoped to normalized email and caller identity key.
- Scope listing image URL resolution to listing membership + visibility/ownership checks before returning storage URLs.
- Keep seller institutional email internal-only: public listing read APIs return sanitized listing DTOs that exclude `sellerEmail`.
- Enforce deterministic report dedupe key (`targetType|targetId|reporterId`) and unique-reporter threshold evaluation for auto-hide/flood controls.
- Continue hardening against abusive query/resource patterns and report brigading.

## Branching Notes

- Integration/test branch: `jaydon/nightly-clean-integration`
- Clean-branch strategy used to replace conflict-heavy PR implementations when necessary.
