# PolyBuys — One-Page Handoff

## What this is

PolyBuys is a Cal Poly–only marketplace for students to buy/sell items (textbooks, tickets, furniture) with built-in messaging and trust/safety controls.

## Current product status

- Listings: create, view, edit, filtering/sorting, tags
- Messaging: conversation + send/read flow
- Safety: reporting + auto-hide workflow
- Access: Cal Poly email requirement
- Sharing: shareable short links and deep-link foundations

## Latest integration branch to test

- `jaydon/nightly-clean-integration`

This branch includes cleaned, tested integrations for:

- Hidden-content handling
- Messaging schema finalization (with compatibility/backfill safety)
- Web-platform updates
- Deep-link setup
- Shareable links
- Pagination/search hardening

## Engineering quality gates (latest pass)

- Backend typecheck: pass
- Frontend typecheck: pass
- Lint: pass
- Prettier check: pass
- Test suite: pass (120/120)

## Key decisions (locked)

- Auth: Cal Poly-only email required
- Moderation: fail-open if moderation service unavailable
- Reports: auto-hide at 3 unique reports
- Scope: full marketplace demo (messaging, reports, shareable links)
- PR policy: reject low-quality stale branches; replace with clean branches when needed

## Known risks

- Report brigading risk (auto-hide threshold abuse)
- Fail-open moderation risk during provider outages
- Some filtered query paths still rely on bounded collect + in-memory filtering
- Existing dependency vulnerabilities in upstream packages

## Immediate next steps (recommended)

1. Manual QA on `jaydon/nightly-clean-integration`:
   - hidden listing behavior
   - messaging flows
   - reporting + auto-hide
   - deep links/share links
2. Decide merge strategy for remaining heavy/conflicted PRs (#43, #25, #48)
3. Add runtime telemetry for query latency + moderation fallback rates
4. Plan dependency vulnerability remediation

## Contact / ownership

- Tech Lead: Jaydon
- Repo: `codebox-calpoly/PolyBuys`
- Design: Figma Poly Buys file
