# 订阅账本（AI Subscription Ledger）

纯订阅/会员账本：订阅、账单、续费提醒、预算统计。业务规则在 `@ai-sub/core`，桌面端与 core demo/parity 摘要保持同一统计口径。

## 当前版本：0.1.3

- 订阅可手动填写，或通过订单文本、JSON 与剪贴板图片 OCR 快速填充。
- 订阅信息拆分为用途分类、购买渠道、计费方式；月付和年付才参与续费提醒，按量计费与额度包无需续费日。
- 旧账本中的「官方 / 中转 / 中转额度包」会在读取时自动迁移到新字段。

## 许可

本仓库源码公开给个人学习、研究、测试和非商用使用。商业使用、商业分发、闭源改造售卖或作为商业服务的一部分使用，均未被授权。

许可协议：PolyForm Noncommercial License 1.0.0，见 [LICENSE](./LICENSE)。

## 下载安装（macOS）

不想自己编译，直接去 [Releases](../../releases/latest) 下载最新 `订阅账本_*.dmg`，打开后把 App 拖进 `/Applications`。

> **首次打开被系统拦截？** 本项目未购买 Apple 开发者证书（$99/年），dmg 是未公证的 ad-hoc 签名，macOS 会提示"无法验证开发者"。这是正常现象，不是文件损坏：
> - **右键点击** App → 选择「打开」→ 弹窗里再点一次「打开」；或
> - 「系统设置」→「隐私与安全性」，往下翻会看到一条阻止提示，点「仍要打开」。
>
> 只需在第一次打开时做一次，之后正常双击即可。

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
| `npm run test` | 运行 core + 桌面前端全部测试 |
| `npm run test:core` | 只跑 `@ai-sub/core` 单元测试 |
| `npm run test:desktop` | 只跑桌面前端测试（jsdom + Testing Library） |
| `npm run parity` | 统计口径回归守卫：与 `scripts/parity-baseline.json` 比对，漂移则失败（改 `stats`/`rules`/`dates` 后必跑） |
| `npm run parity -- --update` | 认可当前输出并重写基准（确认是预期改动后才用，需连同代码一起提交） |
| `npm run check` | `test` + `parity` + `build`（CI 同款） |
| `npm run lint` | ESLint（含 `react-hooks`，桌面前端生效） |

Rust 侧（在 `apps/desktop/src-tauri` 下执行，CI 同款）：

| 命令 | 说明 |
|------|------|
| `cargo test --lib` | `db.rs` 的密钥/加密/归档单元测试 |
| `cargo clippy --all-targets -- -D warnings` | Clippy，零警告 |
| `cargo fmt --check` | 格式检查（提交前跑 `cargo fmt`） |

## 构建：开发版与生产版

- **开发版（热重载）**：`npm run dev`（即 `tauri dev`）。编译 Rust debug 并启动桌面 App，保存源码后自动重载。开发版与打包版共用同一份 `ledger.db` 数据目录。
- **生产版（打包）**：`npm run tauri:build -w @ai-sub/desktop`（即 `tauri build`）。编译 release 并产出：
  - `apps/desktop/src-tauri/target/release/bundle/macos/订阅账本.app` —— 可直接拖入 `/Applications`；
  - `apps/desktop/src-tauri/target/release/bundle/dmg/订阅账本_*.dmg` —— 安装盘。
  - 若 Tauri 的 DMG 阶段受本机沙盒限制，可在 `apps/desktop/src-tauri` 下调用 Tauri 生成的 `target/release/bundle/dmg/bundle_dmg.sh` 重试。
- 构建产物均在 `target/`（已被 gitignore），不会进入仓库。

签名与公证见 [docs/macos-signing.md](./docs/macos-signing.md)。

## 数据位置（桌面）

应用数据目录下的 `ledger.db`（SQLite KV，键 `ai-subscription-tracker-v3`）。当前版本不提供文件导出；迁移设备前请自行保留该应用数据目录的副本。


## 仓库结构

```
packages/core/     # 领域逻辑、导入解析、迁移、统计
apps/desktop/      # Tauri + React 壳
apps/ios/          # 占位，见 docs/ios-roadmap.md
docs/              # 产品与技术文档
scripts/           # parity 等脚本
```

## 开发约定

- 修改 `packages/core/src` 中与统计、续费、导入相关的代码后，执行 **`npm run parity`**。它会把固定参考日期（2026-07-05）下的 core demo 摘要与仓库里的 `scripts/parity-baseline.json` 逐项比对，不一致就列出漂移项并以非零码退出（CI 同款）。确认漂移是预期结果后，用 `npm run parity -- --update` 重写基准。
- core 里凡是与「今天」有关的函数都接受可选的 `ref` 参数（`computeSummary`、`renewRow`、`addBill`、`pickDueDate` 等）。新增此类逻辑时一律从 `ref` 取当前时间，不要直接调 `todayLocalISO()` / `new Date()`——否则该函数无法被确定性地测试。
- `sketches/` 为本地宣传图草稿，不参与发行。
