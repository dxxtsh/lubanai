@echo off
title ∂§∏Á¡™√À AI ÷«≈Ã - CLI

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

:: Load portable environment (current session only)
set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%PATH%"
set "NODE_PATH=%ROOT%\runtime\node_modules"

:: Load OpenClaw if present
if exist "%ROOT%\app\openclaw\" (
    set "PATH=%ROOT%\app\openclaw;%PATH%"
)

echo [∂§∏Á¡™√À AI ÷«≈Ã] Portable environment loaded
echo   Runtime: %ROOT%\runtime
echo   OpenClaw: %ROOT%\app\openclaw
echo   Config: %ROOT%\config
echo   Workspace: %ROOT%\workspace
echo.
echo Usage: opencode ^<command^>
echo Type exit to quit
echo.

:: If argument passed, execute it directly
if not "%~1"=="" (
    %*
    exit /b %ERRORLEVEL%
)

:: Otherwise open interactive shell
cmd
