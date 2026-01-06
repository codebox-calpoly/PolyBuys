#!/bin/bash

# Format all files with Prettier
echo "✨ Formatting code with Prettier..."
npx prettier --write "**/*.{js,jsx,ts,tsx,json,md,yml,yaml}"

echo "✅ Code formatted successfully!"
