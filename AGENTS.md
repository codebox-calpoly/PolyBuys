## Cursor Cloud specific instructions

### Project overview

PolyBuys is a cross-platform marketplace app (Expo React Native) for Cal Poly students, with a Convex serverless backend (cloud or self-hosted). The monorepo has three workspaces: `frontend`, `backend`, `packages/shared`.

### Running services

- **Frontend (web)**: `npx expo start --web --port 8081` from `frontend/` dir (or `npm run dev` from root). Opens at http://localhost:8081. The frontend connects to the remote Convex backend via `EXPO_PUBLIC_CONVEX_URL` — no local database needed.
- **Backend sync**: `npm run dev:backend` runs `convex dev` which syncs functions/schema to the Convex deployment. For Convex cloud, `backend/.env.local` needs `CONVEX_DEPLOYMENT` and `CONVEX_URL`. For self-hosted, it needs `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`.

### Key commands (all from repo root)

See `QUICK_START.md` and `README.md` for full reference. Summary:

- Lint: `npm run lint`
- Format: `npm run format`
- Typecheck: `npm run typecheck`
- Test: `npm test` (Jest + convex-test, 8 suites / 125 tests)
- Dev frontend: `npm run dev` (Expo, press `w` for web)
- Dev backend: `npm run dev:backend` (Convex dev sync)

### Environment variables

- `frontend/.env.local` needs `EXPO_PUBLIC_CONVEX_URL` (the Convex backend URL, injected via Cursor secrets)
- `backend/.env.local` needs Convex connection vars. For cloud: `CONVEX_DEPLOYMENT`, `CONVEX_URL`, `CONVEX_SITE_URL`. For self-hosted: `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`. Optional: `AUTH_RESEND_KEY`, `OPENAI_API_KEY`. See `backend/.env.example` for the self-hosted template.

### Gotchas

- The frontend entry point is `expo-router/entry` (set in `frontend/package.json` `"main"`). Always run `expo start` from the `frontend/` directory, not the repo root.
- `frontend/.npmrc` has `legacy-peer-deps=true` — required for Expo peer dependency resolution.
- Husky pre-commit hook runs `npx lint-staged` (ESLint + Prettier on staged files).
- The backend is entirely remote (Convex cloud or self-hosted on Railway). There is no local database or Docker dependency.
- Tests run without backend credentials — `convex-test` mocks the Convex runtime. The `OPENAI_API_KEY` warning in test output is harmless (moderation is skipped).
- `convex dev` (backend sync) requires interactive Convex login (`npx convex login`). In cloud agent environments, the user must complete the login flow via the Desktop pane before `convex dev` can run.
- You can seed test data via `npx convex run` from the `backend/` directory, e.g. `npx convex run listings:internalCreateListing '{"title":"...", ...}'`.
