@echo off
title LubanAI - Channel Config

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_STATE_DIR=%ROOT%\config"
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"

if not exist "%ROOT%\runtime\node.exe" (
    echo Portable Node.js not found. Run Setup.bat first.
    pause
    exit /b 1
)

"%ROOT%\runtime\node.exe" "%ROOT%\bin\wechat-config.mjs"
