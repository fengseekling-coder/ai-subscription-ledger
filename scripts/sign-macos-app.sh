#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/desktop/src-tauri/target/release/bundle/macos/订阅账本.app"
IDENTITY="${1:-}"

if [[ ! -d "$APP" ]]; then
  echo "未找到 .app，请先: npm run tauri:build -w @ai-sub/desktop" >&2
  exit 1
fi

if [[ -z "$IDENTITY" ]]; then
  echo "Ad-hoc 签名: $APP"
  codesign --force --deep --sign - "$APP"
else
  echo "签名 ($IDENTITY): $APP"
  codesign --force --deep --options runtime --sign "$IDENTITY" "$APP"
fi
codesign --verify --verbose "$APP"
echo "完成。"