@echo off
title 钉哥联盟 AI 智盘 - Setup

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo ============================================
echo   钉哥联盟 AI 智盘 - 便携式环境安装
echo ============================================
echo.

:: ── Check if already set up ──
if exist "%ROOT%\runtime\node.exe" if exist "%ROOT%\node_modules\openclaw\openclaw.mjs" (
    echo [OK] 环境已就绪，直接运行 Windows-Start.bat 即可
    pause
    exit /b 0
)

if not exist "%ROOT%\runtime\node.exe" goto :install_node
:check_deps
if not exist "%ROOT%\node_modules\openclaw\openclaw.mjs" goto :install_deps
goto :verify

:install_node
echo [1/3] 下载 Node.js 便携版...
echo   正在获取最新 LTS 版本号...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    $json = Invoke-RestMethod "https://nodejs.org/dist/index.json"; ^
    $lts = $json | Where-Object { $_.lts } | Select-Object -First 1; ^
    if (-not $lts) { Write-Error "无法获取 Node.js 版本"; exit 1 }; ^
    $ver = $lts.version; ^
    Write-Host "   最新 LTS: $ver"; ^
    $url = "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip"; ^
    $zip = "$env:TEMP\node-setup.zip"; ^
    Write-Host "   下载中..."; ^
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing; ^
    Write-Host "   解压中..."; ^
    if (Test-Path "%ROOT%\runtime") { Remove-Item -Recurse -Force "%ROOT%\runtime" }; ^
    New-Item -ItemType Directory -Force -Path "%ROOT%\runtime" | Out-Null; ^
    Expand-Archive -Path $zip -DestinationPath "$env:TEMP\node-extract" -Force; ^
    $extracted = Get-ChildItem "$env:TEMP\node-extract" -Directory | Select-Object -First 1; ^
    if (-not $extracted) { Write-Error "解压失败"; exit 1 }; ^
    Copy-Item -Recurse -Force "$($extracted.FullName)\*" "%ROOT%\runtime\"; ^
    Remove-Item -Recurse -Force "$env:TEMP\node-extract"; ^
    Remove-Item -Force $zip; ^
    if (Test-Path "%ROOT%\runtime\node.exe") { Write-Host "   [OK] Node.js 安装完成" } ^
    else { Write-Error "Node.js 安装失败"; exit 1 }

if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Node.js 下载或安装失败
    echo   请检查网络连接后重试
    pause
    exit /b 1
)

goto :check_deps

:install_deps
echo [2/3] 安装项目依赖...
echo   正在安装 openclaw ^& 其他依赖（首次需要下载约 500MB）
echo   请耐心等待...

cd /d "%ROOT%"

if not exist "%ROOT%\runtime\npm.cmd" (
    echo [FAIL] npm 未找到，Node.js 安装可能不完整
    pause
    exit /b 1
)

call "%ROOT%\runtime\npm.cmd" install --no-optional --no-audit --no-fund

if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] 依赖安装失败
    pause
    exit /b 1
)

goto :verify

:verify
echo [3/3] 验证安装...

if not exist "%ROOT%\runtime\node.exe" (
    echo [FAIL] Node.js 未找到
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('"%ROOT%\runtime\node.exe" --version') do set "NODE_VER=%%v"

if not exist "%ROOT%\node_modules\openclaw\openclaw.mjs" (
    echo [FAIL] OpenClaw 未安装
    pause
    exit /b 1
)

echo.
echo ============================================
echo   安装完成！
echo   Node.js: %NODE_VER%
echo   OpenClaw: 已就绪
echo.
echo   运行 Windows-Start.bat 启动 钉哥联盟 AI 智盘
echo ============================================
pause
