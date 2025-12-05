# PolyBuys

A marketplace for verified Cal Poly students to buy and sell their belongings, tickets, textbooks, and more. Provides a secure, student-only platform to connect Cal Poly students with one another.

## Tech Stack

- **Frontend**: React Native (Expo) - Cross-platform mobile app
- **Backend**: Convex - Serverless backend with real-time sync
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
- Backend specifics: [backend/convex/README.md](backend/convex/README.md)
- Issue/PR templates: [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE) and [.github/pull_request_template.md](.github/pull_request_template.md)
- Architecture decisions: [docs/adr/](docs/adr/)

## Team

- [Evan Taylor](https://www.linkedin.com/) - Project Manager
- [Jaydon Chen](https://www.linkedin.com/in/jaydon-chen/) - Tech Lead
- [Saman Sepehr](https://www.linkedin.com/) - Tech Lead
- [Chanelle Friend](https://www.linkedin.com/) - Designer
- [Matthew Phan](https://www.linkedin.com/) - Developer
- [Taye Staats](https://www.linkedin.com/) - Developer
- [Cole Hackman](https://www.linkedin.com/) - Developer
- [Lorinc Heutchy](https://www.linkedin.com/) - Developer
- [Haixin Huang](https://www.linkedin.com/) - Developer
- [Domenic Federico](https://www.linkedin.com/) - Developer
- [Omar Garcia](https://www.linkedin.com/) - Developer

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

### Platform-Specific Development

**Mac Users (with Xcode installed):**

```bash
npm run dev
# Press 'i' for iOS Simulator
```

**Windows/Linux Users:**

```bash
# Option 1: Android Emulator (requires Android Studio)
npm run dev
# Press 'a' for Android

# Option 2: Web Browser (easiest, no setup needed)
npm run dev
# Press 'w' for web browser
```

**Testing on Physical Devices:**

- **Android**: Connect via USB with developer mode enabled, run `npm run android`
- **iOS**: Requires Mac with Xcode
- **Note**: Expo Go app requires SDK 52 - if you have SDK 54+ installed, use web or emulator instead

For detailed setup instructions, see [Contributing Guide](docs/contributing.md).

## 📱 Development

- **Linting**: `npm run lint`
- **Formatting**: `npm run format`
- **Type checking**: `npm run typecheck`
- **Run frontend**: `npm run dev:frontend`
- **Run backend**: `npm run dev:backend`

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
