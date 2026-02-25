#!/bin/bash
# ═══════════════════════════════════════════════
# Skitour Planer — Project Setup Script
# Run this ONCE to scaffold the full Next.js app
# ═══════════════════════════════════════════════

set -e

echo "🏔️  Setting up Skitour Planer..."

# 1. Create Next.js project
npx create-next-app@latest skitour-planner \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint \
  --no-turbopack

cd skitour-planner

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install leaflet react-leaflet @types/leaflet
npm install @anthropic-ai/sdk
npm install fast-xml-parser
npm install jspdf html2canvas

# 3. Create .env.local
echo "🔑 Creating .env.local..."
cat > .env.local << 'EOF'
# Get your key at: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-key-here
EOF

# 4. Create directory structure
echo "📁 Creating directory structure..."
mkdir -p src/components
mkdir -p src/lib
mkdir -p src/app/api/claude
mkdir -p src/app/api/weather
mkdir -p src/app/api/avalanche
mkdir -p src/app/api/geocode

echo ""
echo "✅ Project scaffolded!"
echo ""
echo "Next steps:"
echo "  1. cd skitour-planner"
echo "  2. Add your ANTHROPIC_API_KEY to .env.local"
echo "  3. Copy the source files from src/lib/ and src/components/"
echo "  4. npm run dev"
echo ""
echo "Or better — open Claude Code in this directory:"
echo "  claude"
echo ""
echo "Then tell Claude Code:"
echo '  "Read CLAUDE.md and build the app. Start with the map component and API routes."'
