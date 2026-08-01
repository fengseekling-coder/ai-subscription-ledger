---
kind: configuration_system
name: 配置系统 — Tauri + Vite + npm Workspaces 多包构建配置
category: configuration_system
scope:
    - '**'
source_files:
    - package.json
    - apps/desktop/package.json
    - packages/core/package.json
    - apps/desktop/vite.config.ts
    - apps/desktop/tsconfig.json
    - packages/core/tsconfig.json
    - apps/desktop/src-tauri/tauri.conf.json
    - apps/desktop/src-tauri/capabilities/default.json
    - apps/desktop/src-tauri/Cargo.toml
    - eslint.config.js
---

本仓库采用分层、去中心化的配置体系，围绕 npm workspaces 聚合 @ai-sub/core 领域库与 Tauri+React 桌面应用，各层通过独立配置文件管理自身运行时与构建期行为。

**1. 顶层工作区与脚本编排（npm Workspaces）**
- `package.json` 声明 `workspaces: ["packages/*", "apps/*"]`，统一入口脚本如 `dev`、`build`、`test`、`lint`、`parity` 通过 `-w <workspace>` 分派到子包，保证 core 先于 desktop 构建。
- `engines.node >= 20` 与 `packageManager: npm@10.9.2` 锁定 Node 版本与包管理器，避免环境漂移。

**2. 前端构建配置（Vite + React）**
- `apps/desktop/vite.config.ts`：插件仅启用 `@vitejs/plugin-react`；开发服务器固定端口 3000 且 `strictPort: true`；环境变量前缀为 `VITE_` 和 `TAURI_`；构建目标锁定 `es2021, chrome100, safari13`；压缩与 sourcemap 由 `TAURI_DEBUG` 控制。
- `apps/desktop/tsconfig.json`：严格模式开启，`noUnusedLocals/Parameters/FallthroughCasesInSwitch` 全部报错，`isolatedModules` 与 `moduleDetection: force` 配合 bundler 解析。

**3. 核心库配置（@ai-sub/core）**
- `packages/core/tsconfig.json`：输出 ES2022 + NodeNext 模块，生成 `.d.ts` 与 declarationMap，`strict: true`，排除测试文件。
- `packages/core/package.json`：通过 `exports` 字段暴露 ESM 入口 `./dist/index.js` 及类型声明，无运行时依赖。

**4. Tauri 桌面端配置**
- `apps/desktop/src-tauri/tauri.conf.json`：定义应用名、版本号、标识符、窗口尺寸与最小尺寸、CSP 安全策略、打包目标（app/dmg）、图标集、macOS 最低系统版本 10.15、主二进制名 `subscription-ledger`。构建阶段调用 `npm run dev/build`，前端产物位于 `../dist`。
- `apps/desktop/src-tauri/capabilities/default.json`：以能力清单形式声明默认权限，包括 core/window/event/tray/notification/clipboard-manager 等细粒度权限，仅对 `main` 窗口生效。
- `apps/desktop/src-tauri/Cargo.toml`：Rust crate 名称 `subscription_ledger_lib`，启用 `tray-icon` feature；依赖 rusqlite（bundled）、aes-gcm、reqwest（rustls-tls）等；macOS 平台额外引入 objc2-* 与 vision 框架用于 OCR；release profile 开启 LTO、strip、opt-level=s。

**5. 代码质量与一致性配置**
- `eslint.config.js`：基于 flat config，忽略 dist/node_modules/target/gen；对 `apps/desktop/src/**` 启用 react-hooks 推荐规则；core 与 desktop 共享 TypeScript ESLint 规则，关闭 `no-explicit-any`，允许空 catch。
- `scripts/parity-html-core.mjs` 配合根 `parity` 脚本，在 core 构建后校验统计口径 HTML 输出基线，防止回归。

**6. 运行时配置约定**
- 环境变量：Vite 暴露 `VITE_*` 与 `TAURI_*` 前缀变量给前端；Tauri 构建/调试通过 `TAURI_DEBUG` 控制压缩与 sourcemap。
- 无 `.env` 文件或集中式配置加载器；所有配置以 JSON/TOML/JS 静态声明为主，符合“配置即代码”风格。
- Rust 后端不读取外部配置文件，数据库路径、加密密钥等通过命令参数或运行时上下文注入（见 `src/db.rs`、`src/lib.rs` 的函数签名）。