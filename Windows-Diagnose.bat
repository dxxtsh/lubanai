@echo off
title �������� AI ���� - Diagnose

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo ============================================
echo   �������� AI ���� - System Diagnose
echo ============================================
echo.

:: 1. Directory structure check
echo [1/6] Directory structure...
for %%d in (
    "runtime" "config" "workspace"
    "skills" "plugins" "data" "cache" "logs"
    "temp" "update" "assets" "openclaw"
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
    for /f "tokens=*" %%v in ('"%ROOT%\runtime\node.exe" --version 2^>nul') do echo   [OK] %%v
) else (
    echo   [--] Not found
)
echo.

:: 3. Config files
echo [3/6] Config files...
for %%f in (
    "config\lubanai.json"
    "config\provider.json"
    "config\agents.json"
    "config\workspace.json"
    "config\skills.json"
    "config\plugins.json"
    "config\logging.json"
) do (
    if exist "%ROOT%\%%~f" (
        echo   [OK] %%~f
    ) else (
        echo   [--] %%~f (not found)
    )
)
echo.

:: 4. Workspace
echo [4/6] Workspace...
set WS_COUNT=0
if exist "%ROOT%\workspace\" (
    for /d %%d in ("%ROOT%\workspace\*") do set /a WS_COUNT+=1
    echo   [OK] %WS_COUNT% workspace(s)
) else (
    echo   [--] workspace dir missing
)
echo.

:: 5. OpenClaw Runtime
echo [5/6] OpenClaw Runtime...
if exist "%ROOT%\node_modules\openclaw\openclaw.mjs" (
    echo   [OK] openclaw.mjs found
) else (
    echo   [--] openclaw\openclaw.mjs missing
)
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
