@echo off
setlocal

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

:: ---------- Environment ----------
set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%ROOT%\node_modules\.bin;%PATH%"

set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"
set "OPENCLAW_STATE_DIR=%ROOT%\config"
set "OPENCLAW_DISABLE_BONJOUR=1"

:: ---------- Check ----------
if not exist "%ROOT%\runtime\node.exe" (
    echo [ERROR] Portable Node.js not found.
    pause
    exit /b 1
)

if not exist "%ROOT%\node_modules\.bin\openclaw.cmd" (
    echo [ERROR] OpenClaw CLI not installed.
    echo Run Setup.bat first.
    pause
    exit /b 1
)

:: ---------- With arguments: run command directly ----------
if not "%*"=="" (
    call "%ROOT%\node_modules\.bin\openclaw.cmd" %*
    endlocal
    exit /b %ERRORLEVEL%
)

:: ---------- Without arguments: open interactive CLI ----------
title LubanAI - OpenClaw CLI
cmd /k "echo ======================================== && echo   LubanAI Disk - OpenClaw CLI && echo ======================================== && echo. && echo Usage: openclaw ^<command^> [args...] && echo. && echo Common commands: && echo   --version              Show version && echo   gateway run            Start gateway && echo   channels login         Login WeChat channel && echo   plugins list           List installed plugins && echo   doctor --fix           Auto-repair issues && echo   tui                    Terminal UI && echo   help                   Full help && echo. && cd /d \"%ROOT%\""
