# Developer Commands Cheat Sheet

Pin this to your team chat or workspace! 🚀

## 🏁 First Time Setup

```bash
git clone git@github.com:codebox-calpoly/PolyBuy.git
cd PolyBuy
npm install
npm run dev:backend  # Login to Convex
# Copy the Convex URL shown
echo "EXPO_PUBLIC_CONVEX_URL=<url>" > frontend/.env.local
npm run dev          # In a new terminal
```

## 💻 Daily Development

```bash
# Start backend (Terminal 1)
npm run dev:backend

# Start frontend (Terminal 2)
npm run dev

# Check code quality before committing
npm run lint
npm run format
npm run typecheck
```

## 🌿 Git Workflow

```bash
# Start new feature
git checkout dev && git pull
git checkout -b feature/POLY-123-description

# Commit (auto-formatted by pre-commit hooks)
git add .
git commit -m "feat: add X"

# Push and create PR
git push -u origin feature/POLY-123-description
```

## 🔍 Common Issues

| Problem                 | Solution                                 |
| ----------------------- | ---------------------------------------- |
| Metro bundler stuck     | `cd frontend && npm start -- --clear`    |
| Convex not syncing      | Check you're logged into correct project |
| Type errors             | `npm install && npm run typecheck`       |
| Pre-commit hooks broken | `npm install && npx husky install`       |

## 📂 Where to Add Code

| Task               | Location                 |
| ------------------ | ------------------------ |
| New screen         | `frontend/app/`          |
| Reusable component | `frontend/components/`   |
| Custom hook        | `frontend/hooks/`        |
| Backend function   | `backend/convex/`        |
| Shared types       | `packages/shared/types/` |
| Shared utilities   | `packages/shared/utils/` |

## 📱 Test on Phone

1. Install Expo Go app
2. Run `npm run dev`
3. Scan QR code with camera (iOS) or Expo Go (Android)

## 🆘 Need Help?

- Check [CONTRIBUTING.md](docs/contributing.md) for detailed guide
- Check [QUICK_START.md](QUICK_START.md) for more examples
- Ask in team chat!
