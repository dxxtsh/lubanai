# 钉哥联盟 AI 智盘 (LubanAI Disk)

基于 OpenClaw Runtime 的多平台 AI Agent 便携分发版，从 U 盘即插即用，零系统依赖，不写注册表与系统环境变量。

> **当前支持平台**：
> - 🪟 **Windows** (x64 / win32)
> - 🍎 **macOS** (Apple Silicon M1/M2/M3/M4 系列芯片 arm64)

---

## 快速开始

### 🪟 Windows 用户
1. **首次安装**：双击 **`setup.bat`**（自动通过国内加速镜像下载便携 Node.js 并安装依赖）
2. **启动应用**：双击 **`Windows-Start.bat`**

### 🍎 macOS 用户（Apple M 芯片）
1. **首次安装**：双击 **`Setup-Mac.command`**（或在终端运行 `bash setup.sh`，自动下载 darwin-arm64 便携 Node.js、安装依赖并配置权限）
2. **启动应用**：双击 **`Mac-Start.command`**
> *注：Mac 上双击 `.command` 文件即可通过系统终端直接拉起，脚本已内置 `xattr -cr` 解除 macOS 隔离拦截。*

所有依赖均安装在项目目录内，运行数据保存在智盘本地，真正实现零污染。

---

## 目录结构

```
lubanai/
├── runtime/              # 便携版 Node.js（按平台自动下载并隔离）
├── node_modules/         # 项目与 OpenClaw 依赖
├── config/               # 运行时数据与配置目录
│   └── openclaw.json     # OpenClaw 核心网关配置
├── workspace/            # 智能体默认工作区
├── skills/               # 提示词与自定义 Skill 目录（支持热加载）
├── resources/            # 配置前端面板（Config.html 等）
├── src/                  # 智盘 Electron 桌面端源码
├── platform-api/         # 跨平台 Runtime 管理 API
├── shared/               # 共享常量与类型定义
├── assets/               # 应用图标与静态素材
├── bin/                  # 独立辅助脚本与调用桥接
│   ├── wechat-config.mjs # 独立渠道配置服务
│   └── lib/openclaw-bridge.mjs # 跨平台 OpenClaw CLI 调用封装
│
├── 🪟 Windows 入口
│   ├── setup.bat         # Windows 一次性环境初始化
│   ├── Windows-Start.bat # Windows 双击启动主程序
│   ├── Config.bat        # 独立渠道配置面板
│   ├── Repair.bat        # 一键诊断修复
│   └── OpenClaw.bat      # 统一命令行 CLI 入口
│
└── 🍎 macOS (M 芯片) 入口
    ├── Setup-Mac.command # Mac 双击一键初始化（等同于 bash setup.sh）
    ├── Mac-Start.command # Mac 双击启动主程序
    ├── Config.command    # 独立渠道配置面板
    ├── Repair.command    # 一键诊断修复
    └── openclaw.sh       # 统一命令行 CLI 入口
```

---

## 系统架构与启动流程

- **Electron** — 跨平台桌面客户端容器（已适配 Windows 托盘气泡与 macOS 状态栏 Template 图标及系统通知）。
- **OpenClaw** — 生产级 AI Agent 运行时网关。
- **便携版 Node.js** — 位于 `runtime/`，根据当前操作系统自动拉取匹配版本，无需全局安装 Node。

**启动链路**：
- Windows: `Windows-Start.bat` → Electron 主进程 → 嵌入式服务 + OpenClaw Gateway
- macOS: `Mac-Start.command` → Electron 主进程 → 嵌入式服务 + OpenClaw Gateway

---

## 核心功能与操作指南

### 1. 渠道配置
智盘支持一键接入主流国内外即时通讯与协作渠道：

| 渠道 | 接入方式 | 说明 |
| :--- | :--- | :--- |
| 💬 **个人微信** | OpenClaw 官方插件 | 扫码登录，原生微信通道支持 |
| 🏢 **企业微信** | Bot ID + Secret | 企微群聊/单聊智能助理 |
| 📘 **飞书 / Lark** | App ID + Secret | 飞书开放平台机器人应用 |
| 🤖 **Telegram** | Bot Token | Telegram 官方 Bot API |
| 🐧 **QQ 机器人** | App ID + Secret | QQ 开放平台机器人接入 |

#### 独立渠道配置面板（无需打开主程序）
- **Windows**：双击 `Config.bat`
- **macOS**：双击 `Config.command`

系统将独立拉起配置服务并自动调用默认浏览器打开 `http://127.0.0.1:端口/?step=3`，快速完成 API Key 与通道配置。

### 2. 统一 CLI 入口
所有 OpenClaw 命令自动使用内置便携 Node.js 执行：
- **Windows**：`OpenClaw.bat <command>`（直接双击查看快捷交互菜单）
- **macOS**：`./openclaw.sh <command>`

常用命令示例：
```bash
# 查看版本
./openclaw.sh --version               # Windows: OpenClaw.bat --version

# 扫码登录个人微信通道
./openclaw.sh channels login --channel openclaw-weixin

# 检查当前各渠道在线状态
./openclaw.sh channels status

# 启动网关
./openclaw.sh gateway run --port 18789

# 自动诊断并修复环境与配置问题
./openclaw.sh doctor --fix
```

### 3. 一键修复
当遇到后台残留僵尸进程、网络端口占用或环境异常时：
- **Windows**：双击 `Repair.bat`
- **macOS**：双击 `Repair.command`

将自动清理遗留进程、校验配置完整性、执行 `doctor --fix` 并重置依赖与脚本执行权限。

### 4. 配置与 Skills 导入 / 导出
智盘支持全量配置与技能迁移，便于多设备或多学员之间共享：
- **📤 导出配置** (`lubanai-config.json`)：导出渠道、模型、智能体及插件启用状态（自动剔除宿主特定字段）。
- **📥 导入配置**：自动执行原配置备份，智能增量合并，无缝兼容不同版本。
- **📤 导出 Skills** (`lubanai-skills.json`)：一键打包 `skills/` 目录下所有 Markdown 技能文件。
- **📥 导入 Skills**：解包至本地 `skills/` 目录并即时热加载生效。

---

## 随身 U 盘即插即用指南

直接把整个 `lubanai/` 智盘文件夹拷贝到 U 盘中，在任意电脑上实现即插即用：

1. **在 Windows 电脑上**：
   - 首次接入：双击 `setup.bat`（需联网完成极速初始化）；
   - 日常使用：双击 `Windows-Start.bat`。
2. **在 Apple Silicon (M1/M2/M3/M4) Mac 电脑上**：
   - 首次接入：双击 `Setup-Mac.command`；
   - 日常使用：双击 `Mac-Start.command`。
3. **换电脑使用**：
   - 数据、会话记录、微调 Skills 均存放在 U 盘根目录下，拔盘即走，不残留任何隐私数据。

---

## 开源协议

[MIT License](LICENSE)
