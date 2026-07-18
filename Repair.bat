@echo off
title LubanAI Repair

echo ========================================
echo   LubanAI Disk - Repair
echo ========================================
echo.

call "%~dp0OpenClaw.bat" doctor --fix

echo.

call "%~dp0OpenClaw.bat" config validate

echo.
echo ========================================
echo   Repair Complete
echo ========================================
pause
