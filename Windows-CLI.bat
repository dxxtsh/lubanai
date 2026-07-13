@echo off
title LubanAI Disk - CLI

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

:: Load portable environment (current session only)
set "PATH=%ROOT%\runtime;%ROOT%\runtime\node_modules\.bin;%ROOT%\node_modules\.bin;%PATH%"
set "NODE_PATH=%ROOT%\runtime\node_modules"

echo ============================================
echo   LubanAI Disk - 命令行界面
echo   输入 openclaw ^<命令^> 执行操作
echo ============================================
echo.
echo 常用命令（中文说明）:
echo.
echo   openclaw --help          查看所有命令
echo   openclaw ^<命令^> --help  查看某个命令的详细帮助
echo.
echo   openclaw onboard         首次配置向导（模型密钥、网关、频道等）
echo   openclaw configure       修改配置（模型、频道、插件等）
echo   openclaw status          查看网关和频道状态
echo   openclaw doctor --fix    诊断并修复常见问题
echo.
echo   openclaw gateway run     启动网关（可配合 Windows-Start.bat）
echo   openclaw agent --message "你好"   运行一次 AI 对话
echo   openclaw tui             打开终端交互界面
echo.
echo   openclaw channels add    添加聊天频道（Telegram 等）
echo   openclaw channels status 查看已连接的频道
echo   openclaw models status   查看模型/提供商状态
echo   openclaw update          检查更新
echo.
echo 提示: exit 退出; openclaw --help 查看完整命令列表
echo ============================================
echo.

:: If argument passed, execute it directly
if not "%~1"=="" (
    %*
    exit /b %ERRORLEVEL%
)

:: Otherwise open interactive shell
cmd
