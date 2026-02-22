#!/bin/bash

# Installation script for Chandu Construction Backend
# This installs all new dependencies required for production readiness

set -e

echo "============================================"
echo "Installing Production-Ready Dependencies"
echo "============================================"
echo ""

cd "$(dirname "$0")/.."

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Are you in the backend directory?"
  exit 1
fi

echo "📦 Installing dependencies..."
echo ""

npm install

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env"
echo "   cp .env.example .env"
echo ""
echo "2. Edit .env with your configuration"
echo "   nano .env"
echo ""
echo "3. Generate a secure JWT secret:"
echo "   openssl rand -base64 32"
echo ""
echo "4. Run tests to verify installation:"
echo "   npm test"
echo ""
echo "5. Build the application:"
echo "   npm run build"
echo ""
echo "6. Start the server:"
echo "   npm start"
echo ""
echo "============================================"
