# Deploying PolyBuys to Vercel with Convex

This repository is configured so Vercel can deploy both the Convex backend and the Expo web frontend in one build.

## How the build works

Vercel runs:

```bash
npm run build:vercel
```

That script executes:

```bash
cd backend && npx convex deploy --cmd-url-env-var-name EXPO_PUBLIC_CONVEX_URL --cmd 'cd ../frontend && npm run build'
```

`npx convex deploy` does two things during the Vercel build:

1. Deploys the Convex functions in `backend/convex` to the deployment identified by `CONVEX_DEPLOY_KEY`
2. Injects the deployed Convex URL into the frontend build as `EXPO_PUBLIC_CONVEX_URL`

The static web bundle is then emitted to `frontend/dist`, which Vercel serves.

## Vercel project settings

Create a Vercel project for this repository with these settings:

- Root Directory: repository root
- Install Command: `npm install --legacy-peer-deps`
- Build Command: `npm run build:vercel`
- Output Directory: `frontend/dist`

The repository already includes these values in `vercel.json`, so you usually do not need to override them manually.

## Environment variables in Vercel

Set these in the Vercel project:

### Required

- `CONVEX_DEPLOY_KEY`
  - Production scope: use a Convex production deploy key
  - Preview scope: use a Convex preview deploy key if you want preview deployments to get isolated Convex backends

### Optional frontend overrides

- `EXPO_PUBLIC_APP_ORIGIN`
- `EXPO_PUBLIC_SUPPORT_EMAIL`
- `EXPO_PUBLIC_ENABLE_SENTRY_PII`
- `EXPO_PUBLIC_APP_REVIEW_EMAIL`

If `EXPO_PUBLIC_APP_ORIGIN` is not set, the Expo config derives it from Vercel environment metadata for preview and production builds.

## Environment variables in Convex

These do not belong in Vercel. Set them in the Convex dashboard or with `npx convex env set` for the target deployment:

- `CONVEX_SITE_URL`
- `AUTH_RESEND_KEY`
- `AUTH_RESEND_FROM`
- `OPENAI_API_KEY`
- `AUTH_APP_REVIEW_EMAIL`
- `AUTH_APP_REVIEW_CODE`

`CONVEX_SITE_URL` should match the public site origin used for auth callbacks:

- production custom domain, for example `https://polybuys.com`
- or your production Vercel URL if you are not using a custom domain

## Production rollout checklist

1. Create a production deployment in Convex if you do not already have one.
2. Generate a production `CONVEX_DEPLOY_KEY` in Convex and add it to Vercel for the Production environment.
3. Set required Convex deployment env vars, especially `CONVEX_SITE_URL`.
4. Trigger a Vercel production deployment.
5. Verify the deployed site can read and write data against the production Convex deployment.

## Preview deployments

To enable Convex preview deployments:

1. Generate a Convex preview deploy key.
2. Add it to Vercel as `CONVEX_DEPLOY_KEY` scoped only to Preview.
3. Redeploy a preview branch or open a pull request.

Vercel preview builds will then create a branch-specific Convex preview deployment automatically.

## Auth note

If you use Clerk, Auth0, or another auth provider, allow the production site URL in that provider's callback/redirect configuration. If the provider does not support `*.vercel.app` preview domains, use a custom domain for production auth flows.
