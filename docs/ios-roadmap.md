# iOS（Phase 2 脚手架）

## 目标

- 与 Mac 共用 `@ai-sub/core`（业务、统计、迁移解析）
- 数据：首期本地存储；跨端同步或受控备份方案在 iOS 实施时单独设计，后续可选 iCloud 或 Mac 同步

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
3. 受控迁移 / 同步入口（方案待定）
4. Widget：下一续费日（后续）

## 与 Mac 数据交换

```bash
# 待 iOS 实施时确定：iCloud 同步或受控加密传输
```

当前桌面端不提供文件导入或导出；iOS 端不会依赖已移除的 HTML / JSON 迁移流程。
