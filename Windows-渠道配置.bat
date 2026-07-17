@echo off
title LubanAI Channel Config
setlocal enabledelayedexpansion

set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%

echo ========================================
echo   LubanAI - Channel Configuration
echo ========================================
echo.

set "NODE=node"
if exist "%ROOT%\runtime\node.exe" set "NODE=%ROOT%\runtime\node.exe"
if "%NODE%"=="node" (
    where node >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Node.js not found.
        echo Please install Node.js, or run setup.bat to download portable Node.js.
        pause
        exit /b 1
    )
)

echo [OK] Node.js ready
echo.

"%NODE%" "%ROOT%\bin\wechat-config.mjs"
pause
