# 订阅账本（AI Subscription Ledger）

纯订阅/会员账本：订阅、账单、续费提醒、预算统计。业务规则在 `@ai-sub/core`，桌面端与 core demo/parity 摘要保持同一统计口径。

## 许可

本仓库源码公开给个人学习、研究、测试和非商用使用。商业使用、商业分发、闭源改造售卖或作为商业服务的一部分使用，均未被授权。

许可协议：PolyForm Noncommercial License 1.0.0，见 [LICENSE](./LICENSE)。

## 要求

- Node.js **≥ 20**
- macOS 桌面开发另需 [Rust](https://rustup.rs/) 与 Xcode 命令行工具（Tauri 2）

## 安装

```bash
npm install
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Tauri 桌面开发（`apps/desktop`） |
| `npm run build` | 构建 core + 桌面前端 |
| `npm run test:core` | 运行 `@ai-sub/core` 单元测试 |
| `npm run parity` | 输出固定日期的 core demo 摘要（改 `stats`/`rules` 后必跑） |
| `npm run check` | `test:core` + `parity` + `build`（CI 同款） |

桌面打包：

```bash
npm run tauri:build -w @ai-sub/desktop
```

签名与公证见 [docs/macos-signing.md](./docs/macos-signing.md)。

## 数据位置（桌面）

应用数据目录下的 `ledger.db`（SQLite KV，键 `ai-subscription-tracker-v3`）。导出 JSON 为明文备份，请自行保管。

## 仓库结构

```
packages/core/     # 领域逻辑、服务库、迁移、统计
apps/desktop/      # Tauri + React 壳
apps/ios/          # 占位，见 docs/ios-roadmap.md
docs/              # 产品与技术文档
scripts/           # parity 等脚本
```

## 开发约定

- 修改 `packages/core/src` 中与统计、续费、导入相关的代码后，执行 **`npm run parity`**。
- `sketches/`、`vacuum-cursor-state.sh` 为本地草稿/工具，不参与发行。
