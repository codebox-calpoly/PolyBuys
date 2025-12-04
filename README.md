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
