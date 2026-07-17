@echo off
set "ROOT=%~dp0.."
set "OPENCLAW_HOME=%ROOT%"
set "OPENCLAW_CONFIG_PATH=%ROOT%\config\openclaw.json"
set "OPENCLAW_STATE_DIR=%ROOT%\config"
set "TMP=%ROOT%\temp"
set "TEMP=%ROOT%\temp"
"%ROOT%\runtime\node.exe" "%ROOT%\node_modules\openclaw\openclaw.mjs" %*
