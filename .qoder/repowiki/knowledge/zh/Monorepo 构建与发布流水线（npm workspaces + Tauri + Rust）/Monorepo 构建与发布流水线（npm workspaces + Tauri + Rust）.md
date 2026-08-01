---
kind: build_system
name: Monorepo 构建与发布流水线（npm workspaces + Tauri + Rust）
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - .github/workflows/ci.yml
    - apps/desktop/package.json
    - apps/desktop/vite.config.ts
    - packages/core/package.json
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/tauri.conf.json
    - scripts/parity-html-core.mjs
    - scripts/parity-baseline.json
    - scripts/sign-macos-app.sh
    - eslint.config.js
---

## 1. 使用的系统与方法
- **npm workspaces**：根 `package.json` 通过 `workspaces: ["packages/*", "apps/*"]` 聚合 `@ai-sub/core`（领域库）与 `@ai-sub/desktop`（Tauri 桌面应用），统一入口脚本在仓库根。
- **Vite + React**：前端以 Vite 开发/构建，Tauri 的 `beforeDevCommand` 与 `beforeBuildCommand` 串联 npm 脚本。
- **Rust/Tauri 2**：后端使用 `tauri = "2"`，Cargo workspace 位于 `apps/desktop/src-tauri`，release profile 开启 LTO、strip、opt-level=s。
- **GitHub Actions CI**：`.github/workflows/ci.yml` 定义 lint-and-test、build-desktop、security-audit 三阶段流水线，矩阵覆盖 Node 20/22 与 macOS aarch64 目标。
- **统计口径守卫（parity）**：`scripts/parity-html-core.mjs` 用固定参考日期对 core 默认状态生成摘要，与 `scripts/parity-baseline.json` 比对，漂移即失败，支持 `--update` 重写基准。

## 2. 关键文件与位置
- 根工作区与脚本：`package.json`、`eslint.config.js`
- Core 包：`packages/core/package.json`、`packages/core/tsconfig.json`、`packages/core/vitest.config.ts`
- Desktop 应用：`apps/desktop/package.json`、`apps/desktop/vite.config.ts`、`apps/desktop/tsconfig.json`、`apps/desktop/vitest.config.ts`
- Tauri/Rust：`apps/desktop/src-tauri/Cargo.toml`、`apps/desktop/src-tauri/tauri.conf.json`、`apps/desktop/src-tauri/build.rs`、`apps/desktop/src-tauri/src/main.rs`、`apps/desktop/src-tauri/src/lib.rs`
- CI 流水线：`.github/workflows/ci.yml`
- 辅助脚本：`scripts/parity-html-core.mjs`、`scripts/parity-baseline.json`、`scripts/sign-macos-app.sh`

## 3. 架构与约定
- **依赖顺序**：`@ai-sub/desktop` 通过 `dependencies["@ai-sub/core"] = "0.1.3"` 锁定版本；desktop 的 `build` 脚本先执行 `npm run build -w @ai-sub/core && tsc --noEmit && vite build`，确保 dist 产物存在后再构建前端。
- **构建命令链**：
  - 根 `npm run build` → 依次构建 core 与 desktop。
  - 根 `npm run test` → 先跑 core 测试，再跑 desktop 测试（后者依赖已构建的 core dist）。
  - 根 `npm run parity` → 构建 core 后运行 parity 脚本校验统计口径。
- **Tauri 打包流程**：`tauri.conf.json` 指定 `beforeBuildCommand: "npm run build"` 与 `frontendDist: "../dist"`，CI 中通过 `npm run tauri:build -w @ai-sub/desktop -- --target aarch64-apple-darwin --bundles app,dmg` 输出 `.app` 与 `.dmg` 并上传 artifact。
- **Rust 工具链**：CI 安装 stable toolchain + clippy/rustfmt，macOS job 额外安装 `objc2` 等系统依赖；`cargo fmt --check` 与 `cargo clippy --all-targets -- -D warnings` 作为质量门禁。
- **ESLint 配置**：根级 `eslint.config.js` 使用 flat config，忽略 `dist/target/gen`，React Hooks 规则仅作用于 `apps/desktop/src/**`，core 与 desktop 共享 TS 基础规则。

## 4. 约定与约束
- **Node 版本要求**：根 `engines.node >= 20`，CI 矩阵同时验证 20 与 22。
- **包管理器锁定**：根声明 `packageManager: "npm@10.9.2"`，CI 使用 `npm ci` 保证可重复安装。
- **Core 包导出契约**：`main` 与 `exports.import` 均指向 `./dist/index.js`，类型声明在 `./dist/index.d.ts`，测试与 parity 脚本直接 import 该路径，因此必须先 `tsc` 构建。
- **统计口径不可漂移**：`scripts/parity-html-core.mjs` 在默认 `PARITY_REF=2026-07-05T12:00:00` 下比对 `scripts/parity-baseline.json`，任何不一致都会以非零退出码失败；只有显式传入 `--update` 才允许更新基准。
- **安全审计**：CI 分别运行 `npm audit --audit-level moderate` 与 `cargo audit`，两者均设置 `continue-on-error: true` 作为告警而非阻断。
- **macOS 签名**：`scripts/sign-macos-app.sh` 提供 ad-hoc 或指定 identity 的 `codesign` 封装，未传参时强制 deep 签名并 verify。
- **Tauri 能力与安全**：`capabilities/default.json` 与 `tauri.conf.json` 中的 CSP 策略限制资源来源，仅允许 self 与 data URI。
- **构建产物路径**：前端产出到 `apps/desktop/dist`，Rust 产物到 `apps/desktop/src-tauri/target/*/release/bundle/**`，CI 通过 glob 上传 `.app` 与 `.dmg`。