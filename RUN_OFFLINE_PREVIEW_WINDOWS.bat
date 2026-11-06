@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Please install Node.js 22 from https://nodejs.org & pause & exit /b 1)
start "" http://localhost:4173
node scripts\serve-preview.mjs
pause
