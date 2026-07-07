# 订阅账本 · macOS 桌面端

## 技术栈

| 层 | 技术 |
|----|------|
| UI | React 19 + Vite |
| 壳 | Tauri 2 |
| 存储 | SQLite（`ledger.db`，键 `ai-subscription-tracker-v3`） |
| 业务 | `@ai-sub/core`（桌面端与 core demo/parity 摘要使用同一统计口径） |

## 数据位置

```
~/Library/Application Support/com.azhuilab.subscription-ledger/ledger.db
```

首次启动若库为空，**不会**自动塞示例数据，界面会引导你用 **服务库** 添加。产品说明见 [product.md](./product.md)。

## 命令

在仓库根目录：

```bash
npm install
npm run dev              # 开发：Vite + Tauri 窗口
npm run build            # 构建 core + 前端静态资源
npm run test:core        # 业务单测
npm run parity           # 固定日期的摘要 JSON（验收对照）
```

桌面打包（需本机 Xcode 命令行工具）：

```bash
npm run tauri:build -w @ai-sub/desktop
```

产物：`apps/desktop/src-tauri/target/release/bundle/macos/订阅账本.app`

## 功能

**Phase 0**

- 概览 / 已过期 / 账单 / 待续费（3 天内）
- 本月支出（账单 `paidAt` 自然月）、月预算
- 续费推进 `dueDate` + `kind: renewal` 账单
- JSON 导入导出（v3）
- 系统通知（需点击「提醒」授权）

**Phase 1**

- **HTML 迁移**：工具栏「HTML 迁移」— 粘贴 `localStorage` 副本或选择 `.json` / `.html`
- **统计**：按分类本月支出、近 6 个月趋势；列表仍用分类色块（官方 / 中转 / 额度包）
- **菜单栏**：托盘图标显示待续费数量与下一续费；点击「待续费」跳转主窗口

签名分发见 [macos-signing.md](./macos-signing.md)。

## 与 HTML 版差异

| 项 | HTML | 桌面 |
|----|------|------|
| 存储 | localStorage | SQLite |
| 设置续费日 | `prompt` | 日期选择弹窗 |
| 通知 | 浏览器 Notification | macOS 通知 |

数值与排序应以 `@ai-sub/core` 为准；HTML 仅作 UI 对照。
