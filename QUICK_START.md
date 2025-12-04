# Quick Reference for Developers

## 🚀 Daily Development Commands

```bash
# Start development (run both in separate terminals)
npm run dev:backend    # Terminal 1: Start Convex backend
npm run dev           # Terminal 2: Start Expo app

# Code quality
npm run lint          # Check for linting errors
npm run format        # Auto-format all files
npm run typecheck     # Check TypeScript types

# Git workflow
git checkout dev
git pull origin dev
git checkout -b feature/POLY-123-description
# ... make changes ...
git add .
git commit -m "feat: add feature"  # Pre-commit hooks auto-run
git push -u origin feature/POLY-123-description
# Open PR on GitHub
```

## 📱 Testing on Device

1. Install **Expo Go** on your phone
2. Run `npm run dev`
3. Scan QR code:
   - **iOS**: Use Camera app
   - **Android**: Use Expo Go app

## 🛠️ Common Tasks

### Add a new feature

1. Create branch: `feature/POLY-XXX-description`
2. Add code in `frontend/app/` or `backend/convex/`
3. Update types in `packages/shared/types/` if needed
4. Commit with conventional format: `feat: add X`
5. Open PR with Linear issue key

### Fix a bug

1. Create branch: `fix/POLY-XXX-description`
2. Fix the bug
3. Commit: `fix: resolve X`
4. Open PR

### Add shared types

Edit `packages/shared/types/` - automatically available in frontend and backend

### Use shared utilities

```typescript
import { formatPrice, isCalPolyEmail } from '@polybuy/shared';
```

## 🐛 Troubleshooting

**Metro bundler issues?**

```bash
cd frontend
npm start -- --clear
```

**Convex not syncing?**

```bash
npm run dev:backend
# Check if logged in to correct project
```

**Type errors after pulling?**

```bash
npm install
npm run typecheck
```

**Pre-commit hooks not running?**

```bash
npm install
npx husky install
```

## 📚 Key Files

- `README.md` - Project overview
- `docs/contributing.md` - Detailed contribution guide
- `CHANGELOG.md` - Track changes
- `.github/PULL_REQUEST_TEMPLATE.md` - PR template
- `frontend/app/` - App screens
- `backend/convex/` - Backend functions
- `packages/shared/` - Shared code

## 💡 Tips

- Pre-commit hooks auto-format your code
- Use TypeScript for type safety
- Check Linear for assigned issues
- Ask in team chat if stuck!
