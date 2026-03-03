# PolyBuys Convex Backend

This directory contains all Convex schema and function code for PolyBuys.

## Main Modules

- `schema.ts`: canonical data model and indexes.
- `auth.ts`, `ResendOTP.ts`: Cal Poly OTP auth provider wiring.
- `listings.ts`: listing CRUD, search/filter, and pagination.
- `messages.ts`: conversations, message send/read, inbox queries, migrations.
- `reports.ts`: abuse reporting, duplicate checks, auto-hide policy.
- `moderation.ts`: OpenAI moderation calls + fail-open audit logging.

## Local Commands

From repo root:

```bash
npm run dev:backend
npm run typecheck --workspace=backend
npm run build --workspace=backend
npm run deploy --workspace=backend -- --dry-run --typecheck enable
```

## Operational Notes

- Moderation policy is fail-open: OpenAI outages should not block listing/message flows.
- Report auto-hide threshold is 3 unique reporters.
- Messaging schema supports `text` + `system` message types.
- Backfill entrypoint for messaging compatibility fields:
  - `npx convex run messages:startBackfill`

## Security and Data Handling

- Authenticated access is required for write operations.
- Report and message/listing payloads are bounded to prevent runaway resource use.
- Moderation audit stores a text hash + redacted preview with TTL cleanup.
- Never store secrets in repo files. Configure env vars in deployment/runtime.

## Troubleshooting

- If deploy dry-run fails with network/DNS errors, verify runner egress and Convex endpoint reachability.
- If generated API types drift, run `npm run dev:backend` to regenerate `convex/_generated`.
