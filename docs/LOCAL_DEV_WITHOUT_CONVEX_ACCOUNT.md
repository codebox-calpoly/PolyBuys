# Local Development Without Convex Team Access

Use this guide if you are contributing to PolyBuys but are **not** a member of the Convex Cloud team.
This workflow runs Convex locally on your machine and optionally seeds your local database from a backup ZIP.

## Prerequisites

- Node.js and npm versions that satisfy this repo's `package.json` engines.
- Repo cloned locally.
- Dependencies installed from repo root:

```bash
npm install
```

## 1) Configure backend for a local Convex deployment

From `backend/`, run:

```bash
npx convex dev --local --once
```

This configures the project to use a local deployment (no Convex account required) and writes local settings to `backend/.env.local`.

If this project was previously configured for Convex Cloud, this command safely switches it to local mode.

## 2) Start the backend dev loop

From repo root, run:

```bash
npm run dev:backend
```

Keep this command running while you develop. In local mode, stopping this process also stops the local Convex deployment.

## 3) Point the frontend to your local backend

1. Open `backend/.env.local`.
2. Copy the value of `CONVEX_URL`.
3. Create or update `frontend/.env.local`:

```bash
EXPO_PUBLIC_CONVEX_URL=<copied CONVEX_URL value>
```

For most local setups, this URL is `http://127.0.0.1:3210`.

If you need auth email or moderation flows locally, ask a tech lead (or check the Shared Google doc) for required backend secrets and add them to `backend/.env.local` (for example `AUTH_RESEND_KEY`, `AUTH_RESEND_FROM`, and `OPENAI_API_KEY`).

## 4) Seed your local database from a backup ZIP (optional but recommended, so you have some data to work with)

Two backup ZIPs currently exist in the repo root:

- `convex-selfhost-backup-dev.zip` (recommended for day-to-day development)
- `convex-selfhost-final.zip` (final production migration backup)

From `backend/`, import one of them:

```bash
npx convex import --replace ../convex-selfhost-backup-dev.zip
```

Notes:

- `--replace` replaces data in tables included in the ZIP.
- Re-run the same import if you want to reset your local data to a known snapshot.

## 5) Start the frontend

From repo root (in a second terminal):

```bash
npm run dev
```

## Common Issues

- **Unauthorized / deployment access errors**: run `npx convex dev --local --once` again in `backend/`.
- **App points to cloud instead of local**: verify `frontend/.env.local` uses your local `CONVEX_URL`.
- **No generated types**: ensure `npm run dev:backend` is running and has generated files in `backend/convex/_generated/`.
- **Using a physical phone with Expo Go**: `127.0.0.1` points to the phone itself, not your laptop. Use simulator/emulator/web for local-only backend access, or switch to a shared cloud URL.

## Switching back to Convex Cloud later

If you later receive Convex team access:

```bash
cd backend
npx convex disable-local-deployments
npx convex dev --configure
```

Then set `frontend/.env.local` back to the cloud URL.
