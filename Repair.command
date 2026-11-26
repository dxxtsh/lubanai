#!/usr/bin/env bash
cd "$(dirname "$0")"
ROOT="$(pwd)"

echo "========================================"
echo "   钉哥联盟 AI 智盘 - 一键修复"
echo "========================================"
echo ""

export OPENCLAW_HOME="$ROOT"
export OPENCLAW_STATE_DIR="$ROOT/config"
export OPENCLAW_CONFIG_PATH="$ROOT/config/openclaw.json"
export PATH="$ROOT/runtime/bin:$ROOT/node_modules/.bin:$PATH"
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

echo "[1/4] 清理遗留后台进程..."
pkill -f "openclaw" 2>/dev/null || true
pkill -f "electron" 2>/dev/null || true

if [ ! -f "$ROOT/runtime/bin/node" ]; then
    echo "[2/4] 便携版 Node.js 缺失，重新下载安装..."
    bash "$ROOT/scripts/setup-node.sh"
fi

echo "[2/4] 验证并修复 OpenClaw 配置..."
if [ -f "$ROOT/openclaw.sh" ]; then
    bash "$ROOT/openclaw.sh" doctor --fix 2>/dev/null || true
    echo ""
    bash "$ROOT/openclaw.sh" config validate 2>/dev/null || true
elif [ -f "$ROOT/node_modules/openclaw/openclaw.mjs" ]; then
    "$ROOT/runtime/bin/node" "$ROOT/node_modules/openclaw/openclaw.mjs" doctor --fix 2>/dev/null || true
    echo ""
    "$ROOT/runtime/bin/node" "$ROOT/node_modules/openclaw/openclaw.mjs" config validate 2>/dev/null || true
fi

echo ""
echo "[3/4] 修复依赖与 Electron 二进制..."
if [ -d "$ROOT/runtime/bin" ] || command -v npm >/dev/null 2>&1; then
    npm config set ignore-scripts false
    npm install --no-audit --no-fund
    if [ -f "$ROOT/node_modules/electron/install.js" ]; then
        node "$ROOT/node_modules/electron/install.js"
    fi
fi

echo ""
echo "[4/4] 重新赋予执行权限与清除 macOS 隔离属性..."
find "$ROOT" -maxdepth 2 \( -name "*.command" -o -name "*.sh" \) -exec chmod +x {} +
chmod -R +x "$ROOT/runtime/bin" 2>/dev/null || true
xattr -cr "$ROOT" 2>/dev/null || true

echo ""
echo "========================================"
echo "   修复完成！"
echo "   双击 Mac-Start.command 重新启动"
echo "========================================"
