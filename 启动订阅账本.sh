#!/bin/zsh
set -e
killall subscription-ledger 2>/dev/null || true
killall "订阅账本" 2>/dev/null || true
sleep 0.3
APP="/Users/azhuilab/ai账号订阅/dist/订阅账本.app"
BIN="$APP/Contents/MacOS/subscription-ledger"
if [ ! -x "$BIN" ]; then
  echo "找不到应用: $BIN" >&2
  exit 1
fi
echo "正在启动订阅账本..."
exec "$BIN"
