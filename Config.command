#!/usr/bin/env bash
cd "$(dirname "$0")"
ROOT="$(pwd)"

export OPENCLAW_HOME="$ROOT"
export OPENCLAW_STATE_DIR="$ROOT/config"
export OPENCLAW_CONFIG_PATH="$ROOT/config/openclaw.json"
export PATH="$ROOT/runtime/bin:$ROOT/node_modules/.bin:$PATH"

if [ ! -f "$ROOT/runtime/bin/node" ]; then
    echo "[错误] 便携版 Node.js 未找到，请先运行 setup.sh"
    read -n 1 -s -r -p "按任意键退出..."
    echo ""
    exit 1
fi

echo "========================================"
echo "   钉哥联盟 AI 智盘 - 独立配置面板"
echo "========================================"

"$ROOT/runtime/bin/node" "$ROOT/bin/wechat-config.mjs"
