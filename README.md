# PolyBuys

A marketplace for verified Cal Poly students to buy and sell their belongings, tickets, textbooks, and more. Provides a secure, student-only platform to connect Cal Poly students with one another.

## Tech Stack

- **Frontend**: React Native (Expo) - Cross-platform mobile app
- **Backend**: Convex Cloud - Serverless backend with real-time sync
- **Language**: TypeScript - Type-safe development
- **Monorepo**: npm workspaces - Shared types and utilities
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks

## Repository Structure

```
PolyBuys/
├── frontend/          # Expo React Native mobile app
├── backend/           # Convex serverless functions
├── packages/shared/   # Shared TypeScript types and utilities
├── docs/              # Documentation and ADRs
├── scripts/           # Build and tooling scripts
└── .github/           # Issue/PR templates
```

## Where to Look

- Quick start & daily commands: [QUICK_START.md](QUICK_START.md)
- Contribution process and workflow: [docs/contributing.md](docs/contributing.md)
- Local setup without Convex account: [docs/LOCAL_DEV_WITHOUT_CONVEX_ACCOUNT.md](docs/LOCAL_DEV_WITHOUT_CONVEX_ACCOUNT.md)
- Convex migration runbook: [docs/CONVEX_CLOUD_MIGRATION.md](docs/CONVEX_CLOUD_MIGRATION.md)
- Vercel + Convex deployment: [docs/VERCEL_CONVEX_DEPLOYMENT.md](docs/VERCEL_CONVEX_DEPLOYMENT.md)
- Legacy self-hosted reference: [docs/SELF_HOSTED_CONVEX.md](docs/SELF_HOSTED_CONVEX.md)
- Schema migration guide: [docs/SCHEMA_MIGRATION.md](docs/SCHEMA_MIGRATION.md)
- Backend specifics: [backend/convex/README.md](backend/convex/README.md)
- Issue/PR templates: [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE) and [.github/pull_request_template.md](.github/pull_request_template.md)
- Architecture decisions: [docs/adr/](docs/adr/)

## Team

- [Evan Taylor](https://www.linkedin.com/in/evan-l-taylor/) - Project Manager
- [Jaydon Chen](https://www.linkedin.com/in/jaydon-chen/) - Tech Lead
- [Saman Sepehr](https://www.linkedin.com/) - Tech Lead
- [Chanelle Friend](https://www.linkedin.com/) - Designer
- [Taye Staats](https://www.linkedin.com/in/taye-staats-8b8994372/) - Developer
- [Matthew Phan](https://www.linkedin.com/in/matthewphanm) - Developer
- [Cole Hackman](https://www.linkedin.com/in/colehackman/) - Developer
- [Lorinc Heutchy](https://www.linkedin.com/in/lorinc-heutchy) - Developer
- [Haixin Huang](https://www.linkedin.com/in/haixin-huang-116799200) - Developer
- [Domenic Federico](www.linkedin.com/in/domenic-federico-0b85b8298) - Developer

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Expo Go app (for mobile testing)
- Git

### Quick Start

```bash
# Clone the repository
git clone git@github.com:codebox-calpoly/PolyBuys.git
cd PolyBuys

# Install dependencies
npm install

# Start the Convex backend (in one terminal)
npm run dev:backend

# Start the Expo app (in another terminal)
npm run dev
```

If you do not have Convex Cloud team access, use the local workflow in [docs/LOCAL_DEV_WITHOUT_CONVEX_ACCOUNT.md](docs/LOCAL_DEV_WITHOUT_CONVEX_ACCOUNT.md) before running the commands above.

### Expo Go vs development build

Most day-to-day work uses **Metro only** (JavaScript bundle). You do **not** need to compile native code unless you are changing native config or debugging something that only reproduces in a custom dev client.

| Goal                                                    | Command (from repo root)                                                                 | Notes                                                                                                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Start Metro + open in **Expo Go**                       | `npm run dev`, then press **`s`** to switch to Expo Go, then **`i`** / **`a`** / scan QR | Fastest for most contributors. Install [Expo Go](https://expo.dev/go) on device/simulator.                                                                                                                   |
| Start Metro + **iOS Simulator** (no native rebuild)     | `npm run dev`, then **`i`** when using Expo Go mode                                      | If you see “No development build installed”, press **`s`** in the terminal to use Expo Go instead.                                                                                                           |
| Start Metro + **Android** (no native rebuild)           | `cd frontend && npm run android` (or `npm run dev` then **`a`**)                         | Opens emulator with Expo.                                                                                                                                                                                    |
| **Full native build** (Xcode / Gradle compiles the app) | `cd frontend && npm run run:ios` or `npm run run:android`                                | Use when you need the real dev client, native modules, or first-time `ios/` setup. Requires Xcode (iOS), Android SDK (Android), and **CocoaPods** for iOS (`cd frontend/ios && pod install` after prebuild). |

**iOS troubleshooting:** If `expo run:ios` fails on CocoaPods, install the [CocoaPods CLI](https://cocoapods.org/), then run `pod install` inside `frontend/ios`. For signing errors, open the `.xcworkspace` in Xcode, set your **Team** under Signing & Capabilities, then build from Xcode or retry `run:ios`.

More detail: [QUICK_START.md](QUICK_START.md#expo-go-vs-development-build-and-npm-scripts).

### Platform-Specific Development

**Mac Users (with Xcode installed):**

```bash
npm run dev
# Prefer Expo Go: press s, then i for iOS Simulator
# Or press w for web
```

**Windows/Linux Users:**

```bash
# Option 1: Android Emulator (requires Android Studio)
npm run dev
# Press 'a' for Android (use Expo Go on the emulator if prompted)

# Option 2: Web Browser (easiest, no setup needed)
npm run dev
# Press 'w' for web browser
```

**Testing on Physical Devices:**

- **Android**: Install Expo Go, run `npm run dev`, scan the QR code from the terminal (or use tunnel: `cd frontend && npx expo start --tunnel` if the device cannot reach your computer).
- **iOS**: Install Expo Go from the App Store, same flow; on device, you may need tunnel mode on restrictive networks.
- **Custom dev client**: If the project is configured for a development build, run `cd frontend && npm run run:ios` once to install the native app, then use that client with Metro.

For detailed setup instructions, see [Contributing Guide](docs/contributing.md).

## 📱 Development

- **Linting**: `npm run lint`
- **Formatting**: `npm run format`
- **Type checking**: `npm run typecheck`
- **Run frontend**: `npm run dev:frontend`
- **Run backend**: `npm run dev:backend`

### Sentry Privacy Defaults

- Client crash reporting uses Sentry with `sendDefaultPii` disabled by default.
- To explicitly allow default PII fields, set `EXPO_PUBLIC_ENABLE_SENTRY_PII=true` in frontend env config.

### App Review OTP (Optional)

- To enable a fixed Apple App Review login code, configure:
  - Backend: `AUTH_APP_REVIEW_EMAIL`, `AUTH_APP_REVIEW_CODE` (must be 8 digits)
  - Frontend: `EXPO_PUBLIC_APP_REVIEW_EMAIL` (same email value)

Pre-commit hooks automatically format and lint your code before each commit.

## Contributing

We follow a structured git workflow with Linear issue tracking. See [CONTRIBUTING.md](docs/contributing.md) for:

- Development workflow
- Branch naming conventions
- Commit message standards
- PR process
- Code review guidelines

## License

See [LICENSE](LICENSE) for details.

## Documentation

- [Contributing Guide](docs/contributing.md) - How to contribute
- [Architecture Decisions](docs/adr/) - ADRs for major technical decisions
