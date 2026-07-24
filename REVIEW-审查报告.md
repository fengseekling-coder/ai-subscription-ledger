# 订阅账本（ai-subscription-ledger）综合审查报告

> 审查范围：代码质量/结构、安全/密钥泄漏、账本数据、文档。审查日期视角：2026-07-24。
> 审查对象：`packages/core`（@ai-sub/core 领域逻辑）、`apps/desktop`（Tauri+React）、独立 `ai_subscription_tracker.html`、scripts、docs。

---

## 一、代码质量与结构

### 🔴 高：`moneyValue()` 无法解析 `US$` / `USD` 费率（已用 Node 实测确认）
`packages/core/src/money.ts` 的正则 `/[¥￥$,\s/月元]/g` 会去掉 `$`，但**保留 `US`/`USD` 字母**，导致 `parseFloat("US20")` 为 `NaN` → 返回 `0`。

实测：
```
moneyValue("US$20")     -> 0   (应为 20)
moneyValue("US$19.99")  -> 0
moneyValue("USD 20")    -> 0
moneyValue("¥49")       -> 49
moneyValue("$20")       -> 20
```

**影响面（均为真实功能缺陷）：**
- `isRecurringFee()`（`rules.ts`）：`moneyValue(row.fee) > 0` 对美元订阅恒为 `false` → 美元订阅**不被视为周期订阅**，`needsDueDate()` 返回 false → 不提示设置续费日、**不产生续费提醒**。
- `addBill()`（`actions.ts`）：记账单时 `amount: moneyValue(pick.fee)` → 美元订阅记 **¥0**。
- `renewRow()`（`actions.ts`）：`amt = moneyValue(...)` 为 0 → **不生成续费账单**。
- `spendByCategory()`（`analytics.ts`）：`feeMonthlyEst` 用 `moneyValue(r.fee)` → 美元订阅的月度费用估算被**低估为 0**。

注意：应用自身的展示层（`feeDisplayParts`/`looksLikeUsdFee`，`money.ts`）明确支持 `US$`/`USD` 格式，但数值解析层不支持——**内部自相矛盾**。种子数据全部是 `US$20` 等，因此该 bug 直击默认场景。

**修复建议：** 在 `moneyValue` 中同时剥离 `US`/`USD`/`U.S.` 字母，或改为更稳健的数值提取（取第一个数字）：
```ts
const s = String(raw).replace(/[¥￥$\s,/月元]|U\.?S\.?D?/gi, "");
```

### 🟠 中：美元订阅与预算币种不一致（设计缺陷，即便修了 moneyValue 仍在）
- `computeSummary` 的 `monthSpend` 仅来自 `bills`（种子账单硬编码为 RMB：146/73/…），预算默认 `500`（RMB）。
- 但 `addBill` / `renewRow` 用 `moneyValue(fee)` 原值记账，**无任何 USD→CNY 换算**（展示用的 `feeDisplayParts` 才做 `≈¥` 换算，且仅供显示）。
- 后果：用户给一个 `US$20` 订阅点“记账单”，即便修了 moneyValue 也只记 ¥20，而非约 ¥144，**预算统计对美元订阅长期失准**。建议：记账时若 `looksLikeUsdFee(fee)` 为真，按 `USD_CNY_RATE` 折算金额入库。

### 🟡 低：`updateRowField` 对布尔字段缺乏类型保护
`actions.ts` 的 `updateRowField` 仅对 `category/plan/fee` 调 `normalizeRow`，其它字段（如 `subscribed`、`expired` 本应为 boolean）若以字符串 `"true"` 传入，会被存成字符串而非布尔值，破坏 `isActiveSubscription` 等判断。建议对 `subscribed`/`expired` 显式 `Boolean(...)` 转换。

### 🟡 低：`ids.ts` `newId()` 同毫秒可碰撞
`Date.now().toString(36) + Math.random()...` 在高并发/批量导入时理论可重复。当前单用户本地场景风险低，导入大批量时可考虑用 `crypto.randomUUID()`。

### 🟢 信息：桌面 React 壳质量良好
- 全 `apps/desktop/src` **无** `innerHTML` / `dangerouslySetInnerHTML`（默认转义，优于独立 HTML）。
- `MonitorModal.tsx` 对 `apiKey` 用 `type="password"` 输入 + `maskKey()` 显示遮罩，处理得当。
- `ocr_image` 命令（`lib.rs`）已做宽高上限与 `data.length === w*h*4` 校验，避免越界。

---

## 二、安全 / 密钥泄漏

### ✅ 通过：源码中未发现硬编码密钥
全仓 `apiKey`/`api_key`/`secret`/`token`/`Bearer`/`sk-`/`AKIA` 命中项**全部是变量名、字段名或文档里的环境变量占位**（如 `docs/macos-signing.md` 的 `APPLE_ID`/`APPLE_PASSWORD` 仅为 env 名，无真实凭证）。无泄漏。

### ✅ 良好：落盘加密设计
- `apps/desktop/src-tauri/src/db.rs` 用 **AES-256-GCM**，每次写入随机 12 字节 nonce，以 `SUBLEDGER_V1` 魔术前缀区分明文/密文；整包 `AppStateDto`（含 `monitors[].apiKey`）落盘即加密。
- 密钥存 `.ledger_key`：`unix` 下以 `0o600` 创建（仅属主可读）。`Monitor.apiKey` 注释也明确“明文仅在内存，落盘由 db.rs 加密”。✅

### 🟠 跨平台缺口：Windows 下密钥文件权限退化为默认
`write_key_file` 在 `#[cfg(not(unix))]` 分支直接 `std::fs::write`，**无等效 DACL/0o600 限制**。代码注释已说明这是“避免 Keychain 弹窗”的权衡，但若未来出 Windows 包，密钥文件权限需补强（DPAPI 或显式 ACL）。

### 🟢 信息：监控端点
- OpenAI 检查多级回退（subscription → billing/usage → organization/usage → models）合理。
- Cursor 用**非官方内部端点** `api2.cursor.sh`，代码已注明“可能随时变更、脆弱”，仅影响监控状态展示，不影响主流程——可接受，但建议在 UI 提示“非官方，可能不稳定”。

---

## 三、账本数据（`ai_subscription_tracker.html` 种子 + 逻辑）

### ✅ 通过：订阅与账单数据完整、无重复
- 种子 11 个订阅：10 个已订阅 + 1 个愿望单（ChatGPT Team，`subscribed:false`）。
- 10 笔账单，`subscriptionId` 全部能对应到订阅行，**无孤儿账单、无重复 plan/id**。

### 🟡 演示日期已“过期”（属预期，但需注意）
相对“今天” 2026-07-24，种子里 **Cursor Pro 到期日 2026-07-10 已过期 14 天**，会显示“已过期”。其余多为未来日期。纯属演示数据，但用于真实账本前应先更新。

### 🟡 独立 HTML 的 `applyRowMigrations` 会反复改写用户数据（非一次性迁移）
- 每次加载若不存在“Cursor 月卡（不限额度·1并发）”行，就**注入**一条中转订阅（`fee:168`，订单号 `HS2607051DHUBO`）；
- 并把硬编码激活码 `7H5F-TWKQ-1OK3-JZQL` 写入 “Claude 中转” 行的 `usage`。
- 这违背了“迁移应一次性、只修正不注入”的原则，且把演示激活码写进用户数据。
- **关键分叉**：`packages/core/src/load.ts` 的 `applyRowMigrations` 已是 **no-op 桩**（返回 false），即“真实 App”已不再注入；独立 HTML 却保留旧逻辑。**两实现不一致**，建议删除独立 HTML 的注入逻辑或与其对齐。

### 🟡 演示汇率与代码常量不一致（仅数字，不影响功能）
种子账单按 ≈7.3 折算（US$20→146、US$19.99→145.9），而 `money.ts` 的 `USD_CNY_RATE = 7.2`（US$20→144）。展示 `≈¥144` 与账面的 ¥146 小额不一致。建议统一演示数字或显式说明。

---

## 四、文档与 README

### ✅ 通过：README 与 package.json 一致
Node ≥20、workspaces、`npm run dev/build/test:core/parity/check` 均对得上。

### 🟡 `catalog.md` 声称“60+ 条”待核实
`packages/core/src/catalog/entries.ts` 实际条目数未精确清点，建议改为“约 60”或补真实计数，避免文档与代码漂移。

### 🟡 README 未说明独立 HTML 与桌面 App 数据不互通
`ai_subscription_tracker.html`（localStorage）与桌面 App（`ledger.db` SQLite + 加密）是**两套独立实现、存储互不相通**。用户可能误以为共用数据。建议 README 补一句说明，避免混淆。

### 🟢 信息：诚实分级良好
`catalog.md` / `product-mvp.md` 明确 `oauth`/`email` 自动入账“规划未实现”，未过度承诺——与产品定位一致，值得保持。

---

## 五、XSS（补充安全）

### ✅ 主要渲染路径已转义
独立 HTML 虽用 `innerHTML` + 模板字符串，但所有用户输入字段（plan/fee/usage/dueDate/category 及分享图）均经 `escapeHtml()`，且该函数覆盖 `& < > "`。React 桌面版默认转义，**无此问题**。

### 🟡 加固建议
- `escapeHtml` **未转义单引号 `'`**。当前属性统一用双引号包裹用户输入，故暂不构成突破；但建议补全 `&#39;`，并对全部约 9 处 `innerHTML` 站点做一次审计，确保新增插值不漏转义。
- `document.body.innerHTML = chosen`（分享图模式）内容来自已转义的 `shareList/shareBills/shareCover`，安全；但属“整页替换”，需保证 `chosen` 永远来自转义数据。

---

## 优先修复清单

| 优先级 | 问题 | 位置 | 建议 |
|--------|------|------|------|
| 🔴 高 | `moneyValue` 解析 `US$` 返回 0 | `packages/core/src/money.ts` | 正则增加剥离 `US`/`USD`/`U.S.` |
| 🟠 中 | 美元订阅记账无 USD→CNY 换算 | `actions.ts` addBill/renewRow | 识别美元费率时按 `USD_CNY_RATE` 折算入库 |
| 🟠 中 | Windows 密钥文件权限退化 | `db.rs` write_key_file | 非 unix 分支补 DACL/权限限制 |
| 🟡 低 | 迁移反复注入/硬编码激活码 | `ai_subscription_tracker.html` applyRowMigrations | 与 core 对齐，删除注入逻辑 |
| 🟡 低 | 布尔字段缺类型保护 | `actions.ts` updateRowField | 对 subscribed/expired 显式 Boolean |
| 🟡 低 | 文档“60+ 条”待核实 / HTML 与 App 数据不互通未说明 | `docs/catalog.md`、`README.md` | 补真实计数与互通说明 |
| 🟡 低 | escapeHtml 不转义单引号 | `ai_subscription_tracker.html` | 补 `&#39;`，审计所有 innerHTML 站点 |

---

## 总体结论
项目结构清晰、分层合理（core 领域逻辑 / Tauri 后端 / React 前端 / 独立 HTML 三套实现），**安全基线良好**：无硬编码密钥、落盘 AES-256-GCM 加密、前端转义到位。
**最关键的缺陷是 `moneyValue` 对美元费率解析为 0**，会直接影响续费提醒、记账单与预算统计——建议作为最高优先修复；其次是美元订阅的币种换算与 Windows 密钥权限两个中危项。文档与数据结构基本健康，仅需少量对齐与说明补充。
