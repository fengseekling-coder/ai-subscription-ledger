---
kind: error_handling
name: 错误处理体系：Rust thiserror + Result 与前端结构化错误对象
category: error_handling
scope:
    - '**'
source_files:
    - apps/desktop/src-tauri/src/db.rs
    - apps/desktop/src-tauri/src/lib.rs
    - apps/desktop/src-tauri/src/monitor.rs
    - apps/desktop/src-tauri/src/ocr.rs
    - apps/desktop/src/subTableHandlers.ts
    - apps/desktop/src/i18n.ts
---

本仓库的错误处理采用分层设计：Rust 后端使用 `thiserror` 定义强类型错误枚举并通过 `Result<T, E>` 传播，Tauri 命令层将 Rust 错误统一转换为字符串返回给前端；前端 React 层则通过「返回值携带 `{ error: string }`」的结构化对象模式传递业务校验错误，由统一的 `runAction` 包装器捕获并调用 `showNotice` 展示。持久化与加密模块（db.rs）是错误处理最完备的部分，定义了 `DbError` 枚举（含 `Msg(String)` 与 `KeyMissing`），并通过 `From` trait 将 `rusqlite::Error`、`serde_json::Error`、`aes_gcm::Error` 等第三方错误归一化。读路径严格区分「密钥缺失」（可恢复，不改动 ledger.db）与「数据损坏」（归档原文件后报错），写路径通过 `get_or_create_key_in` 与 `require_key_in` 两个专用函数保证密钥生成与读取的语义隔离。OCR 与监控模块使用 `Result<String, String>` 轻量表达成功/失败，网络请求失败被封装为 `MonitorCheckResult.error_message` 字段而非抛出异常。前端 i18n.ts 集中管理所有用户可见的错误文案（如 `feeError`、`statusError`、`retry`），确保中英文一致。整个系统未使用 panic/recover 或全局异常中间件，错误均通过显式返回值传播，测试覆盖关键分支（密钥缺失、归档命名冲突、解密失败等）。