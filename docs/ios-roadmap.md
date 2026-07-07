# iOS（Phase 2 脚手架）

## 目标

- 与 Mac 共用 `@ai-sub/core`（业务、统计、迁移解析）
- 数据：首期 **JSON 导入/导出**（AirDrop / 文件 App），后续可选 iCloud 或 Mac 同步

## 推荐技术路线

| 方案 | 说明 |
|------|------|
| **A. SwiftUI + Swift 包** | 将 core 编译为 JS 不现实；用 Swift 重写薄存储层，或嵌入 **JavaScriptCore** 跑打包后的 core（需 esbuild iOS bundle） |
| **B. Tauri Mobile** | 与桌面同栈，跟踪 Tauri 2 iOS 成熟度 |
| **C. Capacitor + 现有 React** | 复用 `apps/desktop` 的 React UI，SQLite 用 Capacitor 插件 |

当前仓库占位：`apps/ios/README.md`（Xcode 工程待 `npm create tauri-app` 或手动初始化）。

## 首期功能（MVP）

1. 概览列表（只读 + 简单编辑）
2. 待续费（3 天内）
3. 从 Mac 导出 JSON 导入
4. Widget：下一续费日（后续）

## 与 Mac 数据交换

```bash
# Mac 端：导出 → AirDrop 到 iPhone → iOS「导入」
```

v3 JSON 结构与 `importState` / `hydrateImportedState` 一致。