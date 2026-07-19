# macOS 签名与分发

## 本地未签名（自用）

```bash
npm run tauri:build -w @ai-sub/desktop
open apps/desktop/src-tauri/target/release/bundle/macos/订阅账本.app
```

首次打开若被拦截：系统设置 → 隐私与安全性 → 仍要打开。

## Developer ID（给他人安装）

前提：Apple Developer 账号、`Developer ID Application` 证书已导入钥匙串。

1. 在 `apps/desktop/src-tauri/tauri.conf.json` 的 `bundle.macOS` 中配置（示例）：

```json
"macOS": {
  "minimumSystemVersion": "10.15",
  "signingIdentity": "Developer ID Application: Your Name (TEAMID)"
}
```

2. 构建：

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: …"
npm run tauri:build -w @ai-sub/desktop
```

3. 公证（notarize，可选但推荐）：

```bash
# 需 APPLE_ID、APPLE_PASSWORD（app-specific）、APPLE_TEAM_ID
xcrun notarytool submit \
  "apps/desktop/src-tauri/target/release/bundle/dmg/订阅账本_0.1.1_aarch64.dmg" \
  --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" \
  --wait
xcrun stapler staple "apps/desktop/src-tauri/target/release/bundle/macos/订阅账本.app"
```

## Ad-hoc（同团队内测、无开发者账号）

```bash
codesign --force --deep --sign - \
  "apps/desktop/src-tauri/target/release/bundle/macos/订阅账本.app"
```

## 环境变量速查

| 变量 | 用途 |
|------|------|
| `APPLE_SIGNING_IDENTITY` | 签名身份名称 |
| `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` | CI 导入 p12 |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | 公证 |

仓库脚本：`scripts/sign-macos-app.sh`（ad-hoc 或传入 identity）。