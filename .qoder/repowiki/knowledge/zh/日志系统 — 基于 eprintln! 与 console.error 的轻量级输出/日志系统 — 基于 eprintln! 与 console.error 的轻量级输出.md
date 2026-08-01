---
kind: logging_system
name: 日志系统 — 基于 eprintln! 与 console.error 的轻量级输出
category: logging_system
scope:
    - '**'
source_files:
    - apps/desktop/src-tauri/src/db.rs
    - apps/desktop/src-tauri/src/lib.rs
    - apps/desktop/src/SubscriptionFormModal.tsx
---

本仓库未引入专用日志框架（如 `log`、`tracing`、`winston`、`pino` 等），而是采用最简化的原生输出方式：Rust 侧使用 `eprintln!`，前端 TypeScript/React 侧仅在个别错误路径调用 `console.error`。所有日志均为人类可读的字符串拼接，无结构化字段、无日志级别管理、无集中路由或文件落盘。

### 1. 使用的系统与工具
- Rust 后端（Tauri）：仅使用标准库 `eprintln!` 向 stderr 输出；未依赖 `log` 或 `tracing` crate。
- 前端（React + Tauri）：未配置任何日志库，仅在 OCR 失败时通过 `console.error` 输出错误信息。

### 2. 关键文件与位置
- `apps/desktop/src-tauri/src/db.rs`：数据库读写异常时使用 `[db]` 前缀的 `eprintln!` 记录归档失败、密钥缺失、解密失败等信息。
- `apps/desktop/src-tauri/src/lib.rs`：后台监控调度线程使用 `[monitor-scheduler]` 前缀的 `eprintln!` 记录保存状态失败、事件发送失败及线程退出。
- `apps/desktop/src/SubscriptionFormModal.tsx`：OCR 调用失败时通过 `console.error("OCR error:", msg)` 输出。

### 3. 架构与约定
- **无中心化 logger**：每个模块直接调用 `eprintln!` / `console.error`，没有统一的 logger 初始化、配置或拦截器。
- **前缀约定**：Rust 端通过方括号前缀区分来源，如 `[db]`、`[monitor-scheduler]`，便于在终端中快速过滤。
- **无日志级别**：所有输出均为错误/调试信息，未区分 info/debug/warn/error 等级别。
- **无结构化字段**：日志为纯文本字符串拼接，不包含 JSON 结构体、trace_id、时间戳等结构化字段。
- **无持久化**：日志仅输出到 stderr 或浏览器控制台，不会写入文件或远程服务。

### 4. 约定与约束
- Rust 端错误路径统一使用 `eprintln!` 而非返回错误给上层处理（如 `db.rs` 中的归档失败、`lib.rs` 中的 save_state 失败）。
- 前端仅在不可恢复的错误场景（如 OCR 失败）才调用 `console.error`，正常流程不产生日志输出。
- 由于未集成日志框架，无法按环境切换日志级别或输出目标，所有日志始终可见。
- 测试代码中未发现对日志输出的断言或 mock，日志行为不受测试覆盖。

该方案适合小型桌面应用的简单调试需求，但缺乏可观测性、可配置性和生产环境的日志管理能力。