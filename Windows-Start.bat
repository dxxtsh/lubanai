@echo off
title LubanAI Disk

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

if not exist "%ROOT%\runtime\node.exe" (
    echo Portable Node.js not found. Run Setup.bat first.
    pause
    exit /b 1
)

set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%ROOT%\node_modules\.bin;%PATH%"

set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"
set "OPENCLAW_STATE_DIR=%ROOT%\config"
set "OPENCLAW_DISABLE_BONJOUR=1"

if exist "%ROOT%\node_modules\electron\dist\electron.exe" (
    start "" "%ROOT%\node_modules\electron\dist\electron.exe" "%ROOT%"
) else (
    "%ROOT%\runtime\node.exe" "%ROOT%\node_modules\electron\cli.js" "%ROOT%"
)
