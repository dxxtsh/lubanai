@echo off
chcp 936 >nul
echo.
echo OpenClaw 2026.7.1 — 命令行帮助（中文版）
echo ============================================
echo.
echo 用法: openclaw [选项] [命令]
echo.
echo 常用选项:
echo   --help             显示帮助
echo   -V, --version      显示版本号
echo   --no-color         禁用颜色输出
echo   --dev              开发者模式（隔离状态）
echo.
echo 配置向导:
echo   onboard / setup    首次配置向导（模型密钥、频道、网关等）
echo   configure          交互式修改配置
echo   config get/set     直接读写配置文件
echo   doctor --fix       诊断并自动修复问题
echo.
echo 运行管理:
echo   gateway run        启动网关服务
echo   gateway stop       停止网关
echo   status             查看网关和频道状态
echo   health             检查网关健康状态
echo   logs               查看网关日志
echo.
echo AI 对话:
echo   agent              通过网关运行一次 AI 对话
echo   tui / terminal     打开终端交互界面
echo   chat               打开本地终端聊天
echo   message send       发送消息到频道
echo.
echo 模型和提供商:
echo   models status      查看模型/提供商连接状态
echo   models add         添加模型
echo   infer run          运行推理测试
echo.
echo 频道管理:
echo   channels add       添加聊天频道
echo   channels status    查看频道状态
echo   channels remove    删除频道
echo.
echo 插件和技能:
echo   plugins list       查看已安装插件
echo   skills list        查看可用技能
echo.
echo 数据管理:
echo   sessions list      查看对话记录
echo   memory search      搜索记忆文件
echo   transcripts list   查看历史记录
echo   backup create      创建备份
echo   backup restore     恢复备份
echo.
echo 设备与安全:
echo   devices            设备配对管理
echo   approvals          执行审批管理
echo   secrets            密钥管理
echo.
echo 系统管理:
echo   daemon             管理开机自启服务
echo   update             检查更新
echo   uninstall          卸载网关和数据
echo.
echo 示例:
echo   openclaw onboard       首次配置
echo   openclaw status        查看状态
echo   openclaw gateway run   启动网关
echo   openclaw tui           打开终端聊天
echo   openclaw agent --message "你好"  执行一次对话
echo.
echo 文档: https://docs.openclaw.ai/cli
echo ============================================
echo.
pause
