# Contributing

Follow these steps when contributing to the repo! Make sure you have cloned the repo and are all set to go.

- `main` – stable, release branch (protected)
- `dev` – integration branch where all feature work is merged
- `feature/...` – short-lived branches for individual Linear issues

All work follows: **feature branch → PR → dev → main**.  
Never commit directly to `main`.

## Repository Structure

This repo is organized as a monorepo:

- `frontend/` – Expo React Native app (user facing UI)
- `backend/` – Convex functions, schema, and backend logic
- `shared/` – Shared types and utilities used by both frontend and backend
- `docs/` – Documentation, ADRs, and design notes
- `scripts/` – Maintenance and tooling scripts

## Getting Started

1. Clone the repo (SSH or HTTPS):

   ```bash
   git clone git@github.com:<org>/<repo>.git
   cd <repo>
   
2. Switch to the `dev` branch and ensure it’s up to date:
   ```bash
   git checkout dev
   git pull origin dev
Do NOT commit directly to `main`.

## Making Changes

Every Linear issue maps to one feature branch.

1. From dev, create a feature branch:
     ```bash
    git checkout dev
    git pull origin dev
    git checkout -b feature/<linear-key>-short-description
    # e.g. feature/PROJ-12-login-page
2. Make your changes on thie branch.
3. If `dev` has moved while you were working, update your branch:
     ```bash
     git fetch origin
     git merge origin/dev   # or `git rebase origin/dev` if you prefer
  Resolve any merge conflicts, run tests, and commit.
  
## Committing Changes

1. Stage files:

   ```bash
   git add .              # stage all files
   # or
   git add <file-name>    # stage a specific file
2. Commit using [conventional commit messages](https://www.conventionalcommits.org/en/v1.0.0/)
   ```bash
   git commit -m "<type>: <description>"
   # e.g. "feat: add login form" or
   #      "fix: handle empty search query"
3. Push your branch
   ```bash
   `git push -u origin feature/<linear-key>-short-description`

## Making Pull Requests

1. Open a PR on GitHub:
   - Base branch: `dev`
   - Compare branch: `feature/<linear-key>-short-description`
2. Fill out the PR template.
3. Link the PR to the Linear issue (include the issue ID in the
   title/description, e.g. `[PROJ-12] Add login page`).
4. Request a reviewer to check your code
5. Once approved, your code is ready to be merged!

## Code Review Expectations

For authors:

- Keep PRs small and focused around a single Linear issue.
- Fill out the PR template completely.
- Include screenshots or screen recordings for UI changes.

For reviewers:

- Check correctness, readability, and alignment with existing patterns.
- Leave specific, actionable feedback.
- Approve only when you would be comfortable owning the code yourself.

## Tooling and Standards

### Formatting and Linting

- We use **ESLint** and **Prettier**.
- Run them before pushing:
  - `npm run lint`
  - `npm run format`
- CI will run lint and tests on every PR. Fix any issues before requesting review.

We also include an `.editorconfig` file to normalize editor settings.

### Environment Variables and Secrets

- Copy `.env.example` to `.env.local` and fill in the values.
- Never commit real secrets. Do not add `.env*` files to git.
- If you introduce a new environment variable, update `.env.example` and document its purpose.

### Documentation

- If you add a new feature or change behavior, update the `README.md`.
- For significant architectural decisions, add an Architecture Decision Record (ADR) under `docs/adr/`.


## Releases
Tech leads periodically (e.g. every 3 days):
   - Merge `dev` → `main`
   - Deploy from `main`
   - Update Linear issues to reflect what’s been released
