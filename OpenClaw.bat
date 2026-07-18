@echo off
setlocal

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%ROOT%\node_modules\.bin;%PATH%"

set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"
set "OPENCLAW_STATE_DIR=%ROOT%\config"

if not exist "%ROOT%\runtime\node.exe" (
    echo Node runtime not found. Run Setup.bat first.
    exit /b 1
)

if not exist "%ROOT%\node_modules\openclaw\openclaw.mjs" (
    echo OpenClaw not found. Run Setup.bat first.
    exit /b 1
)

"%ROOT%\runtime\node.exe" "%ROOT%\node_modules\openclaw\openclaw.mjs" %*

endlocal
