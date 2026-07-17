@echo off
title LubanAI Channel Config
setlocal enabledelayedexpansion

set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%

echo ========================================
echo   LubanAI - Channel Configuration
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

echo [OK] Node.js ready
echo.

node "%ROOT%\bin\wechat-config.mjs"
pause
