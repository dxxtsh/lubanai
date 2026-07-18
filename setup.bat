@echo off
title LubanAI Disk - Setup

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"
set "OPENCLAW_STATE_DIR=%ROOT%\config"

echo ========================================
echo   LubanAI Disk - Setup
echo ========================================
echo.

if not exist "%ROOT%\runtime\node.exe" (
    echo [1/2] Downloading portable Node.js...
    powershell -ExecutionPolicy Bypass -File "%ROOT%\scripts\setup-node.ps1" -TargetDir "%ROOT%\runtime"
    if errorlevel 1 (
        echo [FAIL] Node.js download failed
        pause
        exit /b 1
    )
)

set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%ROOT%\node_modules\.bin;%PATH%"

echo [2/2] Installing dependencies...
cd /d "%ROOT%"
call "%ROOT%\runtime\npm.cmd" install --no-audit --no-fund
if errorlevel 1 (
    echo [FAIL] Dependency installation failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo   Run Windows-Start.bat to launch
echo ========================================
pause
