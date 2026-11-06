@echo off
setlocal
cd /d "%~dp0"
title Index 00 - Full Stack Studio

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js LTS from https://nodejs.org/
  goto :error
)
where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Please reinstall Node.js LTS with npm enabled.
  goto :error
)

echo.
echo ========================================
echo     INDEX 00 / FULL-STACK STUDIO
echo ========================================
echo.

rem Check actual installed executables/packages, not just the existence of node_modules.
rem This also repairs installs that failed halfway through with npm ETARGET.
if not exist "node_modules\.bin\concurrently.cmd" (
  echo [1/3] Installing launcher dependencies...
  call npm install
  if errorlevel 1 goto :error
) else (
  echo [1/3] Launcher dependencies already installed.
)

if not exist "frontend\node_modules\dexie-react-hooks\package.json" goto :install_frontend
if not exist "frontend\node_modules\.bin\vite.cmd" goto :install_frontend
goto :frontend_ready

:install_frontend
echo [2/3] Installing frontend dependencies...
call npm --prefix frontend install
if errorlevel 1 goto :error

:frontend_ready
echo [2/3] Frontend dependencies ready.
if not exist "backend\node_modules\.bin\tsx.cmd" (
  echo [3/3] Installing backend dependencies...
  call npm --prefix backend install
  if errorlevel 1 goto :error
) else (
  echo [3/3] Backend dependencies already installed.
)

echo.
echo ----------------------------------------
echo Starting INDEX 00...
echo Open http://localhost:5173 in Chrome or Edge.
echo Keep this command window open while editing.
echo Press Ctrl+C to stop the application.
echo ----------------------------------------
echo.
call npm run dev
if errorlevel 1 goto :error
goto :finish

:error
echo.
echo ERROR: Index 00 could not start.
echo Please review the error message above.
echo If this was a network/install problem, run this BAT again after restoring your connection.
pause
exit /b 1

:finish
endlocal
pause
