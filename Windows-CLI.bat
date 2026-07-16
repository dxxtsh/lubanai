@echo off
title LubanAI Disk - CLI

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

:: Load portable environment (current session only)
set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%ROOT%\node_modules\.bin;%PATH%"
set "NODE_PATH=%ROOT%\runtime\node_modules"

:: Isolate OpenClaw to project directory
set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"
set "OPENCLAW_STATE_DIR=%ROOT%\config"
set "OPENCLAW_EMBEDDED_IN=LubanAI Disk"
set "OPENCLAW_DISABLE_BONJOUR=1"

echo ============================================
echo   LubanAI Disk - CLI
echo   All openclaw commands use project config
echo ============================================
echo.
echo Commands:
echo   openclaw --help           Full command list
echo   openclaw <cmd> --help     Subcommand help
echo.
echo   openclaw onboard         First-time setup
echo   openclaw configure       Change configuration
echo   openclaw status          Check health and status
echo   openclaw doctor --fix    Diagnose and repair
echo   openclaw gateway run     Start gateway
echo   openclaw tui             Terminal UI
echo.
echo   openclaw channels add    Add chat channel
echo   openclaw models status   Check models
echo.
echo   exit                     Close this window
echo ============================================
echo.

:: If argument passed, execute it directly
if not "%~1"=="" (
    %*
    exit /b %ERRORLEVEL%
)

:: Otherwise open interactive shell
cmd
