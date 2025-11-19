# Contributing

Follow these steps when contributing to the repo! Make sure you have cloned the repo and are all set to go.

- `main` – stable, release branch (protected)
- `dev` – integration branch where all feature work is merged
- `feature/...` – short-lived branches for individual Linear issues

All work should go **feature branch → dev**.

## Getting Started

1. Clone the repo (SSH or HTTPS):

   ```bash
   git clone git@github.com:<org>/<repo>.git
   cd <repo>
   
2. Make sure you’re on the `dev` branch and up to date:
   ```bash
   git checkout dev
   git pull origin dev
Do not commit directly to `main`.

## Making Changes

Before you start making changes, always make sure you're on the `dev` branch.
Each Linear issue should map to a feature branch.

1. From dev, create a feature branch:
     ```bash
    git checkout dev
    git pull origin dev
    git checkout -b feature/<linear-key>-short-description
    # e.g. feature/PROJ-12-login-page
2. Make your changes
3. If dev has moved while you were working, update your branch before opening a PR:
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

After pushing to `dev`, go to the project repo on Github
1. Create a new Pull Request and fill out the PR template:
   - Base branch: `dev`
   - Compare branch: `feature/<linear-key>-short-description`
2. Fill out the PR template.
3. Link the PR to the corresponding Linear issue (include the issue ID in the
   title/description, e.g. `[PROJ-12] Add login page`).
4. Request a reviewer to check out your code
5. Once approved, your code is ready to be merged!

## Releases
Tech leads periodically (e.g. every 3 days):
   - Merge dev → main
   - Deploy from main
   - Update Linear issues to reflect what’s been released
