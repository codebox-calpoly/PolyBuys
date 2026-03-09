# Legacy Self-Hosted Convex (Archived)

This document is intentionally minimal because PolyBuys has moved to Convex Cloud.

## Current Source of Truth

- Migration/cutover steps: `docs/CONVEX_CLOUD_MIGRATION.md`
- Team onboarding: `docs/contributing.md`
- Project overview: `README.md`

## Legacy Notes

PolyBuys previously ran Convex on Railway with:

- `CONVEX_SELF_HOSTED_URL`
- `CONVEX_SELF_HOSTED_ACTIONS_URL`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`

These variables remain referenced in a few code paths only for backward compatibility during transition windows. New setups should use Convex Cloud.
