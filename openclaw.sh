#!/usr/bin/env bash
cd "$(dirname "$0")"
ROOT="$(pwd)"

export PATH="$ROOT/runtime/bin:$ROOT/node_modules/.bin:$PATH"
export OPENCLAW_HOME="$ROOT"
export OPENCLAW_CONFIG_PATH="$ROOT/config/openclaw.json"
export OPENCLAW_STATE_DIR="$ROOT/config"
export OPENCLAW_DISABLE_BONJOUR=1
export OPENCLAW_NO_UPDATE=1
export OPENCLAW_SKIP_UPDATE_CHECK=1

NODE_BIN="$ROOT/runtime/bin/node"
if [ ! -x "$NODE_BIN" ]; then
    NODE_BIN="node"
fi

OPENCLAW_MJS="$ROOT/node_modules/openclaw/openclaw.mjs"
if [ ! -f "$OPENCLAW_MJS" ]; then
    if [ -f "$ROOT/node_modules/.bin/openclaw" ]; then
        OPENCLAW_MJS="$ROOT/node_modules/.bin/openclaw"
    fi
fi

if [ $# -gt 0 ]; then
    exec "$NODE_BIN" "$OPENCLAW_MJS" "$@"
else
    echo "========================================"
    echo "  钉哥联盟 AI 智盘 - OpenClaw CLI"
    echo "========================================"
    echo ""
    echo "使用方法: ./openclaw.sh <command> [args...]"
    echo ""
    echo "常用命令:"
    echo "  --version              显示版本"
    echo "  gateway run            启动网关"
    echo "  channels login         登录微信通道"
    echo "  plugins list           列出已安装插件"
    echo "  doctor --fix           自动诊断修复"
    echo "  tui                    终端交互界面"
    echo "  help                   查看完整帮助"
    echo ""
    exec "$NODE_BIN" "$OPENCLAW_MJS" --help
fi
