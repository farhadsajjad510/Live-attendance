@echo off
echo 🚀 Live Attendance — Deploying to Firebase...
echo.
echo 📦 Building production bundle...
call npm run build
if errorlevel 1 (echo ❌ Build failed & pause & exit)
echo ✅ Build complete
echo.
echo 🔥 Deploying to Firebase Hosting...
call firebase deploy --only hosting
if errorlevel 1 (echo ❌ Deploy failed. Run: firebase login & pause & exit)
echo.
echo ✅ DEPLOYED!
echo 🌐 Live at: https://live-attendance-d60ca.web.app
pause
