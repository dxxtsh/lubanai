@echo off
title LubanAI Disk - CLI

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

:: Load portable environment (current session only)
set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%ROOT%\node_modules\.bin;%PATH%"
set "NODE_PATH=%ROOT%\runtime\node_modules"

echo LubanAI Disk - Portable CLI
echo   Runtime: %ROOT%\runtime
echo   Config: %ROOT%\config
echo.
echo Usage: openclaw --help
echo Type exit to quit
echo.

:: If argument passed, execute it directly
if not "%~1"=="" (
    %*
    exit /b %ERRORLEVEL%
)

:: Otherwise open interactive shell
cmd
