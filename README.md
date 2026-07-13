# 钉哥联盟 AI 智盘 (LubanAI Disk)

基于 OpenClaw 的 AI Agent 便携分发版，从 U 盘即插即用，无需安装。

## 快速开始

```bash
# 1. 首次安装（下载 Node.js + npm 安装依赖）
setup.bat

# 2. 启动应用
Windows-Start.bat
```

所有依赖都安装在项目目录内，**不写注册表，不装系统环境**。

## 目录结构

```
lubanai/
├── runtime/              # 便携版 Node.js（setup.bat 下载）
├── node_modules/         # 项目依赖（npm install 安装）
├── config/               # 配置文件
│   └── openclaw.json     # OpenClaw 网关配置
├── workspace/            # 用户工作区
├── resources/            # 静态资源（Config.html 等）
├── src/                  # Electron 主进程源码
├── platform-api/         # 平台 API
├── shared/               # 共享常量/类型
├── assets/               # 图标等素材
├── docs/                 # 文档
├── setup.bat             # 一次性安装脚本
├── Windows-Start.bat     # 启动
├── Windows-CLI.bat       # 命令行环境
└── Windows-Diagnose.bat  # 诊断工具
```

## 架构

- **Electron** — 桌面 UI 容器
- **OpenClaw** — AI Agent 运行时网关（npm 依赖）
- **Node.js 便携版** — 位于 `runtime/`，由 `setup.bat` 自动下载

启动流程：`Windows-Start.bat` → Electron → `runtime\node.exe openclaw.mjs gateway run`

## 首次安装说明

1. 确保电脑已联网
2. 双击 `setup.bat`，自动完成：
   - 下载最新 Node.js LTS 到 `runtime/`
   - 运行 `npm install` 安装所有依赖
3. 双击 `Windows-Start.bat` 启动应用
4. 在浏览器中打开 `http://localhost:18789` 配置模型

## 从 U 盘运行

直接把整个 `lubanai/` 文件夹拷贝到 U 盘，在任何 Windows 电脑上：

1. 首次：双击 `setup.bat`（需联网）
2. 每次：双击 `Windows-Start.bat`

换电脑同理。运行数据保存在 U 盘内，不残留任何文件。

## 命令行工具

双击 `Windows-CLI.bat` 进入便携命令行环境，可用 `node`、`npm`、`npx` 命令。

## 诊断

运行 `Windows-Diagnose.bat` 检查环境状态。

## License

MIT
