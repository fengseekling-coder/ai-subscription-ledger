---
kind: external_dependency
name: Tauri 2 桌面应用框架
slug: tauri-2
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
source_files:
    - apps/desktop/src-tauri/Cargo.toml
    - apps/desktop/src-tauri/tauri.conf.json
---

项目使用 Tauri 2 构建 macOS 桌面客户端，Rust 侧通过 `tauri` crate 暴露能力给前端。启用 tray-icon、notification、clipboard-manager 等插件；SQLite 通过 rusqlite（bundled）本地持久化，OCR 在 macOS 上通过 objc2-vision 调用系统 Vision API。生产构建走 `npm run tauri:build`，产物为 .app 和 .dmg。