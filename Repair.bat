@echo off
title LubanAI Repair

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_STATE_DIR=%ROOT%\config"
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"

echo ========================================
echo   LubanAI Disk - Repair
echo ========================================
echo.

call "%ROOT%\OpenClaw.bat" doctor --fix

echo.

call "%ROOT%\OpenClaw.bat" config validate

echo.
echo ========================================
echo   Repair Complete
echo ========================================
pause
