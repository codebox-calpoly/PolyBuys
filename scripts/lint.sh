#!/bin/bash

# Lint all TypeScript/JavaScript files
echo "🔍 Running ESLint..."
npx eslint . --ext .ts,.tsx,.js,.jsx

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ No linting errors found."
  exit 0
else
  echo "❌ Linting errors found. Run 'npm run format' to auto-fix some issues."
  exit 1
fi
