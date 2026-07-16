@echo off
title LubanAI Disk - Diagnose

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

:: Use project config
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"
set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_STATE_DIR=%ROOT%\config"

echo ============================================
echo   LubanAI Disk - System Diagnose
echo ============================================
echo.

:: 1. Directory structure check
echo [1/6] Directory structure...
for %%d in (
    "runtime" "config" "workspace" "skills"
    "plugins" "data" "cache" "logs" "assets"
) do (
    if exist "%ROOT%\%%~d\" (
        echo   [OK] %%~d
    ) else (
        echo   [--] %%~d (missing)
    )
)
echo.

:: 2. Node.js runtime
echo [2/6] Node.js runtime...
if exist "%ROOT%\runtime\node.exe" (
    for /f "tokens=*" %%v in ('"%ROOT%\runtime\node.exe" --version 2^>nul') do echo   [OK] Node.js %%v
) else (
    echo   [--] Not found
)
echo.

:: 3. Config files
echo [3/6] Configuration...
if exist "%ROOT%\config\openclaw.json" (
    echo   [OK] config\openclaw.json
    for /f "tokens=*" %%v in ('"%ROOT%\runtime\node.exe" -e "console.log(JSON.stringify(require('%ROOT:\=\\%config\\openclaw.json'),null,2))" 2^>nul') do echo   %%v
) else (
    echo   [--] config\openclaw.json (missing)
)
echo.

:: 4. OpenClaw Runtime
echo [4/6] OpenClaw runtime...
if exist "%ROOT%\node_modules\openclaw\openclaw.mjs" (
    echo   [OK] openclaw.mjs found
    for /f "tokens=*" %%v in ('"%ROOT%\runtime\node.exe" "%ROOT%\node_modules\openclaw\openclaw.mjs" --version 2^>nul') do echo   Version: %%v
) else (
    echo   [--] openclaw.mjs missing
)
echo.

:: 5. Environment variables
echo [5/6] Environment...
echo   OPENCLAW_HOME=%OPENCLAW_HOME%
echo   OPENCLAW_CONFIG_PATH=%OPENCLAW_CONFIG_PATH%
if exist "%ROOT%\runtime\node.exe" (
    set
) >nul
echo.
echo   OPENCLAW_HOME is set to project: yes
echo.

:: 6. System info
echo [6/6] System info...
for /f "tokens=*" %%v in ('ver') do echo   OS: %%v
echo   Root: %ROOT%
for /f "tokens=3" %%s in ('dir /-c "%ROOT%" ^| findstr /i "free"') do echo   Free disk: %%s
echo.

echo ============================================
echo   Diagnose complete
echo ============================================
pause
