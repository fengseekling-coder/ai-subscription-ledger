---
kind: dependency_management
name: 多语言 Monorepo 依赖管理（npm workspaces + Cargo）
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - packages/core/package.json
    - apps/desktop/package.json
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/Cargo.lock
---

本仓库采用 **npm workspaces** 与 **Cargo** 双栈管理依赖，形成跨语言的 Monorepo 依赖治理体系：

### 1. 使用的系统与工具
- **Node.js 生态**：根 `package.json` 通过 `workspaces: ["packages/*", "apps/*"]` 声明子包，统一由 `npm@10.9.2`（`packageManager` 字段锁定）安装与解析；依赖版本以 `^` 语义化范围声明，构建产物通过 `package-lock.json`（lockfileVersion 3）固化。
- **Rust/Tauri 生态**：`apps/desktop/src-tauri/Cargo.toml` 声明 Rust 依赖，`Cargo.lock` 精确锁定所有 crate 及传递依赖的版本与 checksum，确保可重复构建。
- **CI 集成**：`.github/workflows/ci.yml` 在 CI 中分别对 Node 与 Rust workspace 执行安装、测试与构建，保证依赖一致性。

### 2. 关键文件与包
- `package.json`（根）：定义 workspaces、顶层脚本（`dev`/`build`/`test`/`lint`/`parity`）、`engines.node >= 20` 与 `packageManager` 锁定。
- `package-lock.json`：npm lockfile，记录所有第三方包精确版本与 integrity hash。
- `packages/core/package.json`：领域库 `@ai-sub/core`，仅声明 TypeScript 与 Vitest 开发依赖，无运行时依赖。
- `apps/desktop/package.json`：桌面应用 `@ai-sub/desktop`，依赖 `@ai-sub/core`（workspace 内链接）、React 19、Tauri API 与插件。
- `apps/desktop/src-tauri/Cargo.toml` & `Cargo.lock`：Rust 侧依赖声明与锁文件，包含 Tauri 2、rusqlite、aes-gcm、reqwest 等。

### 3. 架构与约定
- **Monorepo 分层**：`packages/core` 为纯函数式领域库，不依赖任何 UI 或平台框架；`apps/desktop` 作为唯一消费方，通过 npm workspace 内部引用 `@ai-sub/core`（版本号与 workspace 解析并存）。
- **依赖隔离**：core 包无运行时依赖，desktop 包将核心逻辑与 Tauri/Rust 后端解耦，便于单独测试与复用。
- **版本策略**：JS 层使用 `^` 语义化版本范围，允许小版本自动升级；Rust 层通过 `Cargo.lock` 完全锁定，避免传递依赖漂移。
- **构建顺序**：顶层 `build` 脚本先构建 `@ai-sub/core`，再构建 `@ai-sub/desktop`，确保 core 的 `dist/index.js` 与类型声明可用。

### 4. 约定与约束
- **Node 版本锁定**：根 `package.json` 的 `engines.node >= 20` 与 `packageManager: npm@10.9.2` 强制开发环境与 CI 使用相同 Node/npm 版本。
- **Workspace 引用规范**：`@ai-sub/desktop` 直接依赖 `@ai-sub/core` 版本号（当前 `0.1.3`），而非相对路径，保持包间契约清晰。
- **锁文件提交**：`package-lock.json` 与 `Cargo.lock` 均纳入版本控制，禁止本地覆盖导致依赖不一致。
- **私有包与注册表**：未发现 `.npmrc`、`~/.cargo/config.toml` 或 `CARGO_REGISTRY_TOKEN` 等私有源配置，所有依赖均来自公共 npm registry 与 crates.io。
- **无 vendoring**：未使用 `vendor/` 目录或 `--frozen` 之外的离线安装策略，依赖始终从远程注册表拉取。