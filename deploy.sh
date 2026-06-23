#!/bin/bash
# ─── Live Attendance — One-click Deploy Script ─────────────────────────────
echo "🚀 Live Attendance — Deploying to Firebase..."
echo ""

# Build
echo "📦 Building production bundle..."
npm run build
if [ $? -ne 0 ]; then echo "❌ Build failed"; exit 1; fi
echo "✅ Build complete"

# Deploy
echo ""
echo "🔥 Deploying to Firebase Hosting..."
firebase deploy --only hosting
if [ $? -ne 0 ]; then echo "❌ Deploy failed. Run: firebase login"; exit 1; fi

echo ""
echo "✅ DEPLOYED SUCCESSFULLY!"
echo "🌐 Live at: https://live-attendance-d60ca.web.app"
