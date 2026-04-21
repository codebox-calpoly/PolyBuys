# Production Deployment Runbook

This runbook covers PolyBuys production releases for the current architecture:

- Web frontend: Expo web static export hosted on Vercel
- Mobile apps: Expo / EAS builds distributed through TestFlight and app stores
- Backend: Convex Cloud
- Integrations: Resend for email OTP, Sentry for crash reporting, OpenAI moderation

## Infrastructure dependencies

- Vercel project pointed at the repository root
- Convex production deployment and `CONVEX_DEPLOY_KEY`
- Expo / EAS project configured in `frontend/eas.json`
- Resend verified sender domain for `AUTH_RESEND_FROM`
- Sentry project `taylor-labs-llc/polybuys`

## Required environment variables

Frontend build/runtime:

- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_APP_ORIGIN` for non-default web origins
- `EXPO_PUBLIC_SUPPORT_EMAIL` if support address differs from the default
- `EXPO_PUBLIC_ENABLE_SENTRY_PII=false` unless legal/privacy review approves default PII capture
- `EXPO_PUBLIC_APP_REVIEW_EMAIL` only for App Review flows

Convex runtime:

- `CONVEX_SITE_URL`
- `AUTH_RESEND_KEY`
- `AUTH_RESEND_FROM`
- `OPENAI_API_KEY` strongly recommended
- `AUTH_APP_REVIEW_EMAIL`, `AUTH_APP_REVIEW_CODE` only for App Review flows

Vercel-only:

- `CONVEX_DEPLOY_KEY`

See [.env.example](../.env.example), [frontend/.env.example](../frontend/.env.example), and [backend/.env.example](../backend/.env.example) for the source-of-truth templates.

## Release preflight

Run these from the repo root:

```bash
npm ci --include=optional
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
npm audit
```

For a local production sanity check of the web bundle:

```bash
npm run start:prod:web
curl -I http://127.0.0.1:4173
```

## Health and readiness probes

Convex exposes:

- `/healthz` for liveness
- `/readyz` for deployment readiness

`/readyz` returns `503` when required auth or email OTP runtime configuration is missing.

## Web deployment flow

1. Confirm `CONVEX_DEPLOY_KEY` is set in Vercel.
2. Confirm the Convex production deployment has `CONVEX_SITE_URL`, `AUTH_RESEND_KEY`, and `AUTH_RESEND_FROM`.
3. Trigger a Vercel production deployment.
4. Verify:
   - `https://<convex-deployment>/healthz` returns `200`
   - `https://<convex-deployment>/readyz` returns `200`
   - `https://<site>` loads without console/runtime errors
   - sign-in sends an OTP email successfully

## Mobile deployment flow

Automated iOS release workflows already exist in:

- [.github/workflows/ios-release-main.yml](../.github/workflows/ios-release-main.yml)
- [.github/workflows/ios-release-dev.yml](../.github/workflows/ios-release-dev.yml)

Before triggering a mobile release:

1. Run the release preflight checks.
2. Confirm Convex production env vars match the mobile release environment.
3. Confirm the deep-link domain `polybuys.com` still resolves correctly.
4. Build and submit through EAS.

## Post-deploy smoke tests

Run these against production immediately after deploy:

1. Load the landing page and a client-side route such as `/privacy`.
2. Hit Convex `/healthz` and `/readyz`.
3. Request an OTP email and complete sign-in with a Cal Poly email.
4. Open listing search and load at least one listing detail page.
5. Create, edit, and archive a listing with image upload.
6. Send a message in an existing conversation.
7. Verify a new error appears in Sentry if you trigger a controlled test error in a non-user-impacting environment only.

## Rollback

Web / frontend rollback:

1. Redeploy the previous known-good Vercel build or Git commit.
2. Re-run the smoke tests above.

Convex rollback:

1. Re-deploy the previous known-good backend commit to Convex.
2. If a release included risky data changes, restore from a Convex export captured before the release window.
3. Treat `convex import --replace` as a controlled maintenance action only.

Mobile rollback:

1. Stop store rollout if applicable.
2. Re-submit the previous known-good build from EAS artifacts when needed.
3. Keep backend changes backwards-compatible until old clients are drained.

## Data backup and seed policy

- Convex schema is the source of truth in [backend/convex/schema.ts](../backend/convex/schema.ts).
- Before any risky production data change, create a Convex export snapshot.
- Never run ad-hoc seed scripts or `npx convex run ...internalCreate...` against production.
- Development-only backup/import guidance lives in [docs/LOCAL_DEV_WITHOUT_CONVEX_ACCOUNT.md](./LOCAL_DEV_WITHOUT_CONVEX_ACCOUNT.md).
