---
name: convex-backwards-compatibility
description: Keep Convex backend changes backwards-compatible so old TestFlight/App Store clients don't crash. Trigger when editing anything under backend/ or convex/, removing/renaming functions or arguments, or changing schema.
version: 1.0.0
---

# Convex Backwards Compatibility

PolyBuys is a mobile app distributed via TestFlight + App Store. Users can run old binaries for days or weeks before updating. CI deploys Convex and TestFlight together, but:

- External TestFlight testers wait for Apple Beta Review (~24h first time) — backend lands before they get the new build.
- App Store users update on their own schedule; some never update.

**Therefore: Convex functions and schema must be backwards-compatible with the previous released app version.** This is the primary safeguard — there is no CI coordination that fixes a breaking change.

## Safe changes

- Add a new function — old clients don't call it.
- Add an **optional** named argument to an existing function.
- Mark an existing required argument as optional.
- Widen an argument's type to a union including the old type.
- Change function internals as long as old clients' arguments still produce acceptable results.
- Schema: add optional fields; widen field types.

## Unsafe changes (require a migration window)

- Removing or renaming a function a released client calls.
- Renaming an argument.
- Making a previously optional argument required.
- Narrowing an argument's type.
- Schema: adding required fields without a default; removing fields still read by old clients; narrowing field types.

## Migration pattern for unsafe changes

1. **Release A**: deploy the new function/field **alongside** the old one. New app code uses the new path; old clients keep using the old path.
2. Ship a TestFlight/App Store build that uses only the new path.
3. **Release B** (days/weeks later, after old builds are confirmed drained or force-upgraded): remove the deprecated function/field.

For schema field removals: mark optional → stop writing → migrate readers → delete.

## Before merging a Convex change

Ask: _"If a user on the currently-released TestFlight build calls this code path tomorrow, does it still work?"_ If no, you need a migration, not a direct change.

## Enforcement tripwires

Treat these as "stop and plan a migration" signals, not things to just do:

- Deleting an exported function from any file under `backend/convex/` that isn't obviously new-in-this-PR.
- Renaming a function/argument that's referenced from `frontend/`.
- Removing a field from `backend/convex/schema.ts`.
- Changing a `v.optional(...)` to a required validator on an existing argument.

When in doubt, flag it to the user before making the change.

## Reference

- https://docs.convex.dev/production/best-practices#making-safe-changes
