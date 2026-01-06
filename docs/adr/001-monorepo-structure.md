# ADR 001: Use Monorepo with npm Workspaces

## Status

Accepted

## Context

We need to manage multiple related packages (frontend, backend, shared types) in a single repository. We needed to decide between:

- Separate repositories for each package
- Monorepo approach

## Decision

Use a monorepo with npm workspaces to manage frontend, backend, and shared packages together.

## Consequences

### Positive

- **Easier dependency management** - Shared types stay in sync
- **Atomic changes** - Update frontend and backend together in one PR
- **Simplified CI/CD** - Single build/test pipeline
- **Better developer experience** - Clone once, develop everywhere
- **Code sharing** - Easy to share utilities and types

### Negative

- **Larger repository size** - More files to clone initially
- **Learning curve** - Team needs to understand workspace structure
- **Build complexity** - Need to coordinate builds across workspaces

## Alternatives Considered

1. **Separate repositories** - Would require complex versioning and dependency management
2. **Lerna** - More complexity than needed for our project size
3. **Turborepo** - Overkill for current team size, can migrate later if needed

## References

- [npm workspaces docs](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- Industry examples: Google (single repo), Meta (monorepo for React Native)
