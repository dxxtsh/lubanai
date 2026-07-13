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
echo 常用命令:
echo.
echo   openclaw --help          查看所有命令（英文）
echo   help-cn                  查看中文命令帮助
echo   openclaw ^<命令^> --help  查看某个命令的帮助
echo.
echo   openclaw onboard         首次配置向导
echo   openclaw configure       修改配置
echo   openclaw status          查看状态
echo   openclaw doctor --fix    诊断修复
echo.
echo   openclaw gateway run     启动网关
echo   openclaw agent --message "你好"   运行AI对话
echo   openclaw tui             打开终端界面
echo.
echo   openclaw channels add    添加频道
echo   openclaw models status   查看模型状态
echo   openclaw update          检查更新
echo.
echo 提示: exit 退出
echo ============================================
echo.

:: If argument passed, execute it directly
if not "%~1"=="" (
    %*
    exit /b %ERRORLEVEL%
)

:: Otherwise open interactive shell
cmd
