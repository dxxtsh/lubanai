#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
cd ..
ROOT="$(pwd)"

ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ]; then
    echo "=========================================================="
    echo " [错误] 检测到当前机器芯片架构为: $ARCH"
    echo " 当前版本仅支持 Apple M 系列芯片 Mac (Apple Silicon arm64)"
    echo "=========================================================="
    exit 1
fi

NODE_VER="v24.15.0"
NODE_URL="https://npmmirror.com/mirrors/node/${NODE_VER}/node-${NODE_VER}-darwin-arm64.tar.gz"
TEMP_TAR="/tmp/node-${NODE_VER}-darwin-arm64.tar.gz"

echo "========================================"
echo " 钉哥联盟 AI 智盘 - 下载便携版 Node.js"
echo " 目标架构: darwin-arm64 (Apple Silicon)"
echo " 版本: ${NODE_VER}"
echo " 镜像: npmmirror 国内加速"
echo "========================================"

mkdir -p "$ROOT/runtime"

echo "[1/3] 正在下载便携版 Node.js..."
curl -fSL --progress-bar "$NODE_URL" -o "$TEMP_TAR"

echo "[2/3] 正在解压至 runtime 目录..."
tar -xzf "$TEMP_TAR" --strip-components=1 -C "$ROOT/runtime"
rm -f "$TEMP_TAR"

echo "[3/3] 配置可执行权限与移除 macOS 隔离属性..."
chmod -R +x "$ROOT/runtime/bin"
xattr -cr "$ROOT/runtime" 2>/dev/null || true

if [ -f "$ROOT/runtime/bin/node" ] && [ -f "$ROOT/runtime/bin/npm" ]; then
    echo "========================================"
    echo " Node.js 安装成功: $("$ROOT/runtime/bin/node" -v)"
    echo "========================================"
else
    echo "[错误] 解压后未找到 runtime/bin/node 或 runtime/bin/npm"
    exit 1
fi
