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
├── Windows-Start.bat     # 启动应用
├── Config.bat            # 独立渠道配置工具
├── OpenClaw.bat          # 统一 CLI 入口
└── Repair.bat            # 一键修复
```

## 架构

- **Electron** — 桌面 UI 容器
- **OpenClaw** — AI Agent 运行时网关（npm 依赖）
- **Node.js 便携版** — 位于 `runtime/`，由 `setup.bat` 自动下载

启动流程：`Windows-Start.bat` → Electron → 嵌入式 HTTP 服务器 + `OpenClaw.bat gateway run`

## 首次安装说明

1. 确保电脑已联网
2. 双击 `setup.bat`，自动完成：
   - 下载最新 Node.js LTS 到 `runtime/`
   - 运行 `npm install` 安装所有依赖
3. 双击 `Windows-Start.bat` 启动应用
4. 在浏览器中打开 `http://localhost:18789` 配置模型
5. 也可运行 `Config.bat` 独立配置渠道（无需启动应用）

## 从 U 盘运行

直接把整个 `lubanai/` 文件夹拷贝到 U 盘，在任何 Windows 电脑上：

1. 首次：双击 `setup.bat`（需联网）
2. 每次：双击 `Windows-Start.bat`

换电脑同理。运行数据保存在 U 盘内，不残留任何文件。

## 渠道配置

支持接入多个聊天渠道，可在配置页面（Step 3）或独立工具中配置：

| 渠道 | 方式 | 说明 |
|------|------|------|
| 💬 个人微信 | OpenClaw 官方插件 | `OpenClaw.bat channels login --channel openclaw-weixin` |
| 🏢 企业微信 | Bot ID + Secret | 企微群聊应用助手 |
| 📘 飞书 / Lark | App ID + Secret | 飞书群聊与单聊应用 |
| 🤖 Telegram | Bot Token | 官方 Bot API |
| 🐧 QQ 机器人 | App ID + Secret | QQ 开放平台 |

### 独立渠道配置工具

不需要启动完整应用，双击 **`Config.bat`** 即可打开浏览器独立配置渠道。

### 统一 CLI 入口

所有 OpenClaw 命令统一通过 **`OpenClaw.bat`** 执行，双击显示常用命令菜单：

```
OpenClaw.bat --version
OpenClaw.bat channels login --channel openclaw-weixin
OpenClaw.bat channels status
OpenClaw.bat gateway run --port 18789
OpenClaw.bat doctor --fix
```

### 一键修复

运行 **`Repair.bat`** 自动执行：

```
OpenClaw.bat doctor --fix
OpenClaw.bat config validate
```

### 导入 / 导出

支持全量配置迁移，方便从其他 OpenClaw 安装迁移过来：

- **📤 导出配置** (`lubanai-config.json`) → channels / models / agents / plugins / skills 条目的启用状态（跳过 gateway 和版本字段）
- **📥 导入配置** → 自动备份原配置，合并导入可移植字段，兼容不同 OpenClaw 版本
- **📤 导出 Skills** (`lubanai-skills.json`) → 打包 `skills/` 目录下所有 .md 文件
- **📥 导入 Skills** → 解包到 `skills/` 目录

> 迁移只需两个文件：`lubanai-config.json` + `lubanai-skills.json`（如有自定义 skill）

## CLI 环境

运行 `OpenClaw.bat <command>` 直接执行 OpenClaw 命令，自动使用 portable Node.js。

## 目录结构补充

```
lubanai/
├── ...
├── bin/                     # 独立工具脚本
│   ├── wechat-config.mjs    # 渠道配置独立 HTTP 服务
│   └── lib/
│       ├── openclaw-bridge.mjs   # OpenClaw CLI 统一调用封装
├── skills/                  # 技能 .md 文件（可热加载）
├── Config.bat               # 独立渠道配置工具
└── ...
```

## License

MIT
