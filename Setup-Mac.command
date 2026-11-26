#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"

echo "========================================"
echo "   钉哥联盟 AI 智盘 - macOS 初始化安装"
echo "========================================"
echo ""

export OPENCLAW_HOME="$ROOT"
export OPENCLAW_CONFIG_PATH="$ROOT/config/openclaw.json"
export OPENCLAW_STATE_DIR="$ROOT/config"
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

if [ -f "$OPENCLAW_CONFIG_PATH" ]; then
    export OPENCLAW_DISABLE_BUNDLED_PLUGIN_POSTINSTALL=1
    export OPENCLAW_DISABLE_PLUGIN_REGISTRY_MIGRATION=1
    echo "[SKIP] 检测到已有配置文件，跳过覆盖"
fi

if [ ! -f "$ROOT/runtime/bin/node" ]; then
    echo "[1/3] 便携版 Node.js 未找到，开始自动安装..."
    bash "$ROOT/scripts/setup-node.sh"
fi

export PATH="$ROOT/runtime/bin:$ROOT/node_modules/.bin:$PATH"

echo "[2/3] 安装依赖包 (npm install)..."
npm config set ignore-scripts false
npm install --no-audit --no-fund

echo "[3/3] 获取 Electron 二进制文件 (镜像加速)..."
node "$ROOT/node_modules/electron/install.js"

echo "配置项目脚本执行权限与解除 macOS 隔离属性..."
find "$ROOT" -maxdepth 2 \( -name "*.command" -o -name "*.sh" \) -exec chmod +x {} +
chmod -R +x "$ROOT/runtime/bin" 2>/dev/null || true
xattr -cr "$ROOT" 2>/dev/null || true

echo ""
echo "========================================"
echo "   安装完成！"
echo "   双击 Mac-Start.command 即可启动"
echo "========================================"
