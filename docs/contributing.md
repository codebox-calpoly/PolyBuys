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

### Prerequisites

- Node.js 18+ and npm
- Git
- Access to the PolyBuy Convex team (ask tech leads to invite you)
- Expo Go app on your phone (for testing)

### Initial Setup

1. **Clone the repository** (SSH or HTTPS):

   ```bash
   git clone git@github.com:codebox-calpoly/PolyBuy.git
   cd PolyBuy
   ```

2. **Switch to the `dev` branch** and ensure it's up to date:

   ```bash
   git checkout dev
   git pull origin dev
   ```

   Do NOT commit directly to `main`.

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Set up Convex backend**:

   Ask a tech lead to invite you to the Convex team first. Once invited:

   ```bash
   npm run dev:backend
   ```

   This will:
   - Prompt you to login to Convex (creates account if needed)
   - Show you a list of projects - select **PolyBuy**
   - Start the Convex development server
   - Display your deployment URL (save this for the next step)

5. **Configure environment variables**:

   **Frontend:**

   ```bash
   cp frontend/.env.example frontend/.env.local
   ```

   Edit `frontend/.env.local` and add your Convex deployment URL (shown in terminal after step 4):

   ```
   EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   ```

   **Backend:**

   ```bash
   cp backend/.env.example backend/.env.local
   ```

   The `CONVEX_DEPLOYMENT` value is set automatically by `npx convex dev`.

6. **Start the Expo development server**:

   In a new terminal (keep Convex running):

   ```bash
   npm run dev
   ```

   Scan the QR code with:
   - **iOS**: Built-in Camera app
   - **Android**: Expo Go app

You're now ready to develop! 🚀

## Making Changes

Every Linear issue maps to one feature branch.

1. **Pick a Linear issue** from the project board and assign it to yourself.

2. **Create a feature branch** from dev:

   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/<linear-key>-short-description
   # e.g. feature/POLY-12-login-page
   ```

3. **Make your changes** on this branch.

4. If `dev` has moved while you were working, update your branch:
   ```bash
   git fetch origin
   git merge origin/dev   # or `git rebase origin/dev` if you prefer
   Resolve any merge conflicts, run tests, and commit.
   ```

## Committing Changes

1. Stage files:

   ```bash
   git add .              # stage all files
   # or
   git add <file-name>    # stage a specific file
   ```

2. Commit using [conventional commit messages](https://www.conventionalcommits.org/en/v1.0.0/)
   ```bash
   git commit -m "<type>: <description>"
   # e.g. "feat: add login form" or
   #      "fix: handle empty search query"
   ```
3. Push your branch
   ```bash
   `git push -u origin feature/<linear-key>-short-description`
   ```

## Making Pull Requests

1. **Push your branch** to GitHub:

   ```bash
   git push -u origin feature/<linear-key>-short-description
   ```

2. **Open a PR on GitHub**:
   - Base branch: `dev`
   - Compare branch: `feature/<linear-key>-short-description`
   - Title format: `[POLY-123] Add login page`

3. **Fill out the PR template**:
   - Link the Linear issue (e.g., `Linear: POLY-123`)
   - Provide clear summary and testing steps
   - Add screenshots for UI changes

4. **Request reviewers** (assign at least one tech lead or team member)

5. **Address feedback** if changes are requested

6. **Once approved**, a tech lead will merge to `dev`

**Note:** Pre-commit hooks will automatically format your code and run linting before each commit!

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

- **Never commit `.env.local` or any file containing secrets** - these are in `.gitignore`
- If you introduce a new environment variable:
  1. Add it to the appropriate `.env.example` file
  2. Document its purpose in this file
  3. Notify the team in your PR

**Key Environment Variables:**

- `EXPO_PUBLIC_CONVEX_URL` - Your Convex deployment URL (frontend)
- `CONVEX_DEPLOYMENT` - Set automatically by Convex CLI (backend)

Ask tech leads for any additional secrets needed (API keys, etc.)

### Documentation

- If you add a new feature or change behavior, update the `README.md`.
- For significant architectural decisions, add an Architecture Decision Record (ADR) under `docs/adr/`.

## Releases

Tech leads periodically (e.g. every 3 days):

- Merge `dev` → `main`
- Deploy from `main`
- Update Linear issues to reflect what’s been released
