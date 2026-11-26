#!/usr/bin/env bash
cd "$(dirname "$0")"
ROOT="$(pwd)"

echo "========================================"
echo "   钉哥联盟 AI 智盘 - 正在启动..."
echo "========================================"

if [ ! -f "$ROOT/runtime/bin/node" ] || [ ! -d "$ROOT/node_modules" ]; then
    echo "[提示] 检测到环境尚未初始化，正在自动执行 setup.sh..."
    bash "$ROOT/setup.sh"
fi

export PATH="$ROOT/runtime/bin:$ROOT/node_modules/.bin:$PATH"
export OPENCLAW_HOME="$ROOT"
export OPENCLAW_CONFIG_PATH="$ROOT/config/openclaw.json"
export OPENCLAW_STATE_DIR="$ROOT/config"
export OPENCLAW_DISABLE_BONJOUR=1
export OPENCLAW_NO_UPDATE=1
export OPENCLAW_SKIP_UPDATE_CHECK=1

# 解除隔离拦截
xattr -cr "$ROOT" 2>/dev/null || true

# 启动 Electron 应用
./runtime/bin/node ./node_modules/electron/cli.js .
