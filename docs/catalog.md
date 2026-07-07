# 服务库与自动入账

## 服务库（`packages/core/src/catalog/entries.ts`）

当前预置 **60+** 条，覆盖：

| 分段 | 示例 |
|------|------|
| **AI 官方** | ChatGPT、Claude、Gemini、国内（MiniMax、智谱、Kimi、DeepSeek、通义、文心等）、Midjourney、Runway、API 按量 |
| **中转 / 额度** | Claude/GPT/Cursor 中转、额度包 |
| **开发 / 云** | Cursor、Copilot、GitHub、Vercel、Cloudflare、Supabase、JetBrains、AWS Bedrock |
| **设计** | Figma、Adobe、Canva |
| **影音 / 办公** | Spotify、Netflix、B 站、Office 365、iCloud、1Password 等 |

桌面端：**服务库** → 搜索 / 分段筛选 →「加入清单」或「已订阅」。  
**可粘贴入账** 的条目带绿色角标，列表默认排在前面。

## 自动入账（诚实分级）

| syncTier | 含义 | 现状 |
|----------|------|------|
| `paste` | 用户粘贴 JSON 或订单文本 | **已做**：工具栏「粘贴入账」 |
| `none` | 仅预填名称/分类/参考月费/续费页链接 | 服务库一键添加 |
| `email` | 订阅类邮件解析 | 规划，未实现 |
| `oauth` | 官方 API | 规划，未实现 |

### 已实现的粘贴连接器

| connectorId | 适用 |
|-------------|------|
| `relay-order-text` | 订单号、`YYYY-MM-DD`、金额（中转站备注常见格式） |
| `generic-bills-json` | v3 整包、`bills[]` 数组 |
| `openai-usage-json` | OpenAI 用量类 `{ data: [{ amount, date }] }`（会回退到 generic） |

导入规则见 `mergeConnectorResult`：去重订单号/日期+金额；账单默认挂到**最后一条订阅**（建议先添加对应服务）。

## 扩展方式

1. 在 `catalogEntries` 追加 `CatalogEntry`（`rank` 越小越靠前；`syncTier: "paste"` + `connectorId` 即优先展示）。
2. 新格式在 `catalog/connectors.ts` 增加 parser 并注册到 `parsers`。
3. 勿对外承诺「全自动支持一切软件」——与 [product-mvp.md](product-mvp.md) §5.3 一致。