@echo off
title LubanAI Disk - Setup

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo ============================================
echo   LubanAI Disk - Portable Setup
echo ============================================
echo.

:: Check if already set up
if exist "%ROOT%\runtime\node.exe" if exist "%ROOT%\node_modules\openclaw\openclaw.mjs" (
    echo [OK] Already set up. Run Windows-Start.bat
    pause
    exit /b 0
)

:: Install portable Node.js
if not exist "%ROOT%\runtime\node.exe" (
    echo [1/3] Downloading portable Node.js...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\setup-node.ps1" -TargetDir "%ROOT%\runtime"
    if errorlevel 1 (
        echo [FAIL] Node.js download failed
        echo   Check your internet connection and try again
        pause
        exit /b 1
    )
)

:: Install npm dependencies
if not exist "%ROOT%\node_modules\openclaw\openclaw.mjs" (
    echo [2/3] Installing dependencies...
    echo   This will download ~500MB ^(first time only^)

    if not exist "%ROOT%\runtime\npm.cmd" (
        echo [FAIL] npm not found - Node.js install may be incomplete
        pause
        exit /b 1
    )

    :: Remove stale node_modules from pnpm to avoid "workspace:*" errors
    if exist "%ROOT%\node_modules\*" (
        echo   Cleaning old node_modules ^(pnpm artifacts^)...
        rmdir /s /q "%ROOT%\node_modules"
    )

    cd /d "%ROOT%"
    call "%ROOT%\runtime\npm.cmd" install --no-optional --no-audit --no-fund
    if errorlevel 1 (
        echo [FAIL] Dependency installation failed
        pause
        exit /b 1
    )
)

:: Verify
echo [3/3] Verifying...

if not exist "%ROOT%\runtime\node.exe" (
    echo [FAIL] Node.js not found
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('"%ROOT%\runtime\node.exe" --version') do set "NODE_VER=%%v"

if not exist "%ROOT%\node_modules\openclaw\openclaw.mjs" (
    echo [FAIL] OpenClaw not found
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Setup complete!
echo   Node.js: %NODE_VER%
echo   OpenClaw: ready
echo.
echo   Run Windows-Start.bat to launch
echo ============================================
pause
