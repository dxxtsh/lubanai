@echo off
title �������� AI ���� - Launcher

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo [�������� AI ����] v0.1.0 - Starting...
echo.

:: --- 1. Environment Check ---
set "ENV_OK=1"

if not exist "%ROOT%\runtime\node.exe" (
    echo [FAIL] Node.js not found: %ROOT%\runtime\node.exe
    set "ENV_OK=0"
)

if "%ENV_OK%"=="0" (
    echo.
    echo [ERROR] Environment check failed. Press any key to exit.
    pause
    exit /b 1
)

echo [OK] Environment check passed
echo.

:: --- 2. Load Portable Runtime ---
set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%PATH%"
set "NODE_PATH=%ROOT%\runtime\node_modules"

:: --- 3. Start Electron App ---
echo [OK] Starting �������� AI ����...
echo.

if exist "%ROOT%\node_modules\.bin\electron.cmd" (
    call "%ROOT%\node_modules\.bin\electron.cmd" "%ROOT%"
) else if exist "%ROOT%\node_modules\electron\dist\electron.exe" (
    start "" "%ROOT%\node_modules\electron\dist\electron.exe" "%ROOT%"
) else (
    echo [WARN] Electron not installed, trying npm start...
    if exist "%ROOT%\package.json" (
        pushd "%ROOT%"
        call npx electron .
        popd
    ) else (
        echo [ERROR] Cannot start Electron app
        pause
        exit /b 1
    )
)

echo.
echo �������� AI ���� started.
echo.
pause