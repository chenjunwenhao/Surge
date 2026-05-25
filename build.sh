#!/bin/bash
# MySQL Explorer - Build script for Mac & Windows
# Prerequisites: Node.js >= 18, npm

set -e
cd "$(dirname "$0")"

echo "=== Step 1: Build frontend ==="
npx vite build

echo ""
echo "=== Step 2: Package for Mac (DMG + ZIP) ==="
npx electron-builder --mac

echo ""
echo "=== Step 3: Package for Windows (NSIS installer + portable EXE) ==="
# npx electron-builder --win --x64

echo ""
echo "=== Done! Check release/ directory ==="
ls -lh release/
