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

if "%1"=="" goto :usage

"%ROOT%\runtime\node.exe" "%ROOT%\node_modules\openclaw\openclaw.mjs" %*
endlocal
exit /b %ERRORLEVEL%

:usage
echo ========================================
echo   LubanAI Disk - OpenClaw CLI
echo ========================================
echo.
echo Usage: OpenClaw.bat ^<command^> [args...]
echo.
echo Common commands:
echo   --version              Show version
echo   gateway run            Start gateway (port 18789)
echo   channels login         Login WeChat channel
echo   channels status        Check channel status
echo   plugins install ...    Install a plugin
echo   plugins list           List installed plugins
echo   config validate        Validate config
echo   doctor --fix           Auto-repair common issues
echo   tui                    Terminal UI
echo   help                   Full help
echo.
echo Examples:
echo   OpenClaw.bat --version
echo   OpenClaw.bat channels login --channel openclaw-weixin
echo   OpenClaw.bat gateway run --port 18789
echo.
endlocal