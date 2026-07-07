import type { CatalogEntry } from "./types.js";

const R_AUTO = 0;
const R_AI = 10;
const R_RELAY = 20;
const R_DEV = 30;
const R_OTHER = 50;

/** 服务目录：AI / 中转 / 开发 / 设计 / 影音 / 办公 / 云；syncTier 高者优先展示 */
export const catalogEntries: CatalogEntry[] = [
  // —— 可粘贴同步（优先）——
  {
    id: "openai-api-usage",
    category: "官方",
    segment: "ai",
    plan: "OpenAI API（用量导出）",
    feeHint: "按量",
    recurring: false,
    syncTier: "paste",
    connectorId: "openai-usage-json",
    portalUrl: "https://platform.openai.com/usage",
    tags: ["API", "GPT"],
    rank: R_AUTO,
  },
  {
    id: "cursor-billing",
    category: "官方",
    segment: "dev",
    plan: "Cursor Pro / Business",
    feeHint: "20",
    recurring: true,
    syncTier: "paste",
    connectorId: "generic-bills-json",
    subscribeUrl: "https://cursor.com/settings",
    portalUrl: "https://cursor.com/settings",
    tags: ["IDE", "AI"],
    rank: R_AUTO + 1,
  },
  {
    id: "github-copilot",
    category: "官方",
    segment: "dev",
    plan: "GitHub Copilot",
    feeHint: "10",
    recurring: true,
    syncTier: "paste",
    connectorId: "generic-bills-json",
    portalUrl: "https://github.com/settings/billing",
    tags: ["IDE"],
    rank: R_AUTO + 2,
  },

  // —— 官方 AI ——
  { id: "chatgpt-plus", category: "官方", segment: "ai", plan: "ChatGPT Plus", feeHint: "20", recurring: true, syncTier: "none", portalUrl: "https://chat.openai.com/", tags: ["OpenAI"], rank: R_AI },
  { id: "chatgpt-team", category: "官方", segment: "ai", plan: "ChatGPT Team", feeHint: "25", recurring: true, syncTier: "none", portalUrl: "https://chat.openai.com/", tags: ["OpenAI"], rank: R_AI + 1 },
  { id: "claude-pro", category: "官方", segment: "ai", plan: "Claude Pro", feeHint: "20", recurring: true, syncTier: "none", portalUrl: "https://claude.ai/settings/billing", tags: ["Anthropic"], rank: R_AI + 2 },
  { id: "claude-api", category: "官方", segment: "ai", plan: "Claude API / Console", feeHint: "按量", recurring: false, syncTier: "paste", connectorId: "generic-bills-json", portalUrl: "https://console.anthropic.com/", tags: ["Anthropic", "API"], rank: R_AI + 3 },
  { id: "gemini-advanced", category: "官方", segment: "ai", plan: "Google Gemini Advanced", feeHint: "19.99", recurring: true, syncTier: "none", portalUrl: "https://one.google.com/", tags: ["Google"], rank: R_AI + 4 },
  { id: "copilot-m365", category: "官方", segment: "ai", plan: "Microsoft Copilot Pro", feeHint: "20", recurring: true, syncTier: "none", portalUrl: "https://account.microsoft.com/services", tags: ["Microsoft"], rank: R_AI + 5 },
  { id: "perplexity-pro", category: "官方", segment: "ai", plan: "Perplexity Pro", feeHint: "20", recurring: true, syncTier: "none", portalUrl: "https://www.perplexity.ai/settings", tags: [], rank: R_AI + 6 },
  { id: "midjourney", category: "官方", segment: "ai", plan: "Midjourney", feeHint: "10", recurring: true, syncTier: "none", portalUrl: "https://www.midjourney.com/account", tags: ["图像"], rank: R_AI + 7 },
  { id: "runway", category: "官方", segment: "ai", plan: "Runway", feeHint: "15", recurring: true, syncTier: "none", portalUrl: "https://app.runwayml.com/", tags: ["视频"], rank: R_AI + 8 },
  { id: "poe-sub", category: "官方", segment: "ai", plan: "Poe 订阅", feeHint: "20", recurring: true, syncTier: "none", portalUrl: "https://poe.com/", tags: [], rank: R_AI + 9 },
  { id: "minimax-plus", category: "官方", segment: "ai", plan: "MiniMax Plus", feeHint: "49", recurring: true, syncTier: "none", portalUrl: "https://www.minimaxi.com/", tags: ["国内"], rank: R_AI + 10 },
  { id: "domestic-ai-coding", category: "官方", segment: "ai", plan: "国内 AI Coding 订阅", feeHint: "", recurring: true, syncTier: "none", tags: ["国内"], rank: R_AI + 11 },
  { id: "domestic-ai-agent", category: "官方", segment: "ai", plan: "国内 AI Agent 订阅", feeHint: "", recurring: true, syncTier: "none", tags: ["国内"], rank: R_AI + 12 },
  { id: "moonshot-kimi", category: "官方", segment: "ai", plan: "Kimi 会员", feeHint: "49", recurring: true, syncTier: "none", portalUrl: "https://kimi.moonshot.cn/", tags: ["国内"], rank: R_AI + 13 },
  { id: "deepseek-api", category: "官方", segment: "ai", plan: "DeepSeek API", feeHint: "按量", recurring: false, syncTier: "paste", connectorId: "generic-bills-json", portalUrl: "https://platform.deepseek.com/", tags: ["国内", "API"], rank: R_AI + 14 },
  { id: "doubao", category: "官方", segment: "ai", plan: "豆包 / 火山引擎", feeHint: "按量", recurring: false, syncTier: "none", portalUrl: "https://console.volcengine.com/", tags: ["国内"], rank: R_AI + 15 },
  { id: "tongyi-qwen", category: "官方", segment: "ai", plan: "通义千问会员", feeHint: "19.9", recurring: true, syncTier: "none", portalUrl: "https://tongyi.aliyun.com/", tags: ["国内", "阿里"], rank: R_AI + 16 },
  { id: "wenxin", category: "官方", segment: "ai", plan: "文心一言会员", feeHint: "59.9", recurring: true, syncTier: "none", portalUrl: "https://yiyan.baidu.com/", tags: ["国内", "百度"], rank: R_AI + 17 },
  { id: "xai-grok", category: "官方", segment: "ai", plan: "xAI Grok", feeHint: "16", recurring: true, syncTier: "none", portalUrl: "https://x.ai/", tags: [], rank: R_AI + 18 },
  { id: "replicate", category: "官方", segment: "ai", plan: "Replicate", feeHint: "按量", recurring: false, syncTier: "none", portalUrl: "https://replicate.com/account/billing", tags: ["API"], rank: R_AI + 19 },
  { id: "huggingface-pro", category: "官方", segment: "ai", plan: "Hugging Face Pro", feeHint: "9", recurring: true, syncTier: "none", portalUrl: "https://huggingface.co/settings/billing", tags: ["API"], rank: R_AI + 20 },
  { id: "elevenlabs", category: "官方", segment: "ai", plan: "ElevenLabs", feeHint: "5", recurring: true, syncTier: "none", portalUrl: "https://elevenlabs.io/", tags: ["语音"], rank: R_AI + 21 },
  { id: "suno", category: "官方", segment: "ai", plan: "Suno", feeHint: "10", recurring: true, syncTier: "none", portalUrl: "https://suno.com/", tags: ["音乐"], rank: R_AI + 22 },
  { id: "notion-ai", category: "官方", segment: "ai", plan: "Notion AI 附加", feeHint: "10", recurring: true, syncTier: "none", portalUrl: "https://www.notion.so/", tags: ["办公"], rank: R_AI + 23 },
  { id: "jetbrains-ai", category: "官方", segment: "dev", plan: "JetBrains AI Assistant", feeHint: "10", recurring: true, syncTier: "none", portalUrl: "https://account.jetbrains.com/", tags: ["IDE"], rank: R_AI + 24 },
  { id: "codeium", category: "官方", segment: "dev", plan: "Codeium Pro", feeHint: "10", recurring: true, syncTier: "none", portalUrl: "https://codeium.com/", tags: ["IDE"], rank: R_AI + 25 },
  { id: "windsurf", category: "官方", segment: "dev", plan: "Windsurf / Codeium", feeHint: "15", recurring: true, syncTier: "none", portalUrl: "https://codeium.com/windsurf", tags: ["IDE"], rank: R_AI + 26 },
  { id: "aws-bedrock", category: "官方", segment: "cloud", plan: "AWS Bedrock", feeHint: "按量", recurring: false, syncTier: "none", portalUrl: "https://console.aws.amazon.com/bedrock/", tags: ["云", "API"], rank: R_AI + 27 },

  // —— 中转 / 聚合 ——
  { id: "relay-monthly-a", category: "中转", segment: "relay", plan: "中转月费套餐 A", feeHint: "", recurring: true, syncTier: "paste", connectorId: "relay-order-text", tags: ["中转"], rank: R_RELAY },
  { id: "relay-monthly-b", category: "中转", segment: "relay", plan: "中转月费套餐 B", feeHint: "", recurring: true, syncTier: "paste", connectorId: "relay-order-text", tags: ["中转"], rank: R_RELAY + 1 },
  { id: "relay-api-pool", category: "中转", segment: "relay", plan: "API 聚合中转站", feeHint: "", recurring: true, syncTier: "paste", connectorId: "relay-order-text", tags: ["中转"], rank: R_RELAY + 3 },
  { id: "credit-api-pack", category: "中转额度包", segment: "credit", plan: "API 额度包", feeHint: "", recurring: false, syncTier: "paste", connectorId: "relay-order-text", tags: ["额度"], rank: R_RELAY + 4 },

  // —— 开发 / SaaS ——
  { id: "github-pro", category: "官方", segment: "dev", plan: "GitHub Pro / Team", feeHint: "4", recurring: true, syncTier: "none", portalUrl: "https://github.com/settings/billing", tags: [], rank: R_DEV },
  { id: "vercel-pro", category: "官方", segment: "dev", plan: "Vercel Pro", feeHint: "20", recurring: true, syncTier: "none", portalUrl: "https://vercel.com/account", tags: [], rank: R_DEV + 1 },
  { id: "netlify-pro", category: "官方", segment: "dev", plan: "Netlify Pro", feeHint: "19", recurring: true, syncTier: "none", portalUrl: "https://app.netlify.com/", tags: [], rank: R_DEV + 2 },
  { id: "cloudflare-pro", category: "官方", segment: "cloud", plan: "Cloudflare Pro", feeHint: "20", recurring: true, syncTier: "none", portalUrl: "https://dash.cloudflare.com/", tags: [], rank: R_DEV + 3 },
  { id: "digitalocean", category: "官方", segment: "cloud", plan: "DigitalOcean", feeHint: "按量", recurring: false, syncTier: "none", portalUrl: "https://cloud.digitalocean.com/", tags: [], rank: R_DEV + 4 },
  { id: "supabase-pro", category: "官方", segment: "dev", plan: "Supabase Pro", feeHint: "25", recurring: true, syncTier: "none", portalUrl: "https://supabase.com/dashboard", tags: [], rank: R_DEV + 5 },
  { id: "figma-pro", category: "官方", segment: "design", plan: "Figma Professional", feeHint: "15", recurring: true, syncTier: "none", portalUrl: "https://www.figma.com/", tags: ["设计"], rank: R_DEV + 6 },
  { id: "adobe-cc", category: "官方", segment: "design", plan: "Adobe Creative Cloud", feeHint: "68", recurring: true, syncTier: "none", portalUrl: "https://account.adobe.com/", tags: ["设计"], rank: R_DEV + 7 },
  { id: "canva-pro", category: "官方", segment: "design", plan: "Canva Pro", feeHint: "12.99", recurring: true, syncTier: "none", portalUrl: "https://www.canva.com/", tags: ["设计"], rank: R_DEV + 8 },

  // —— 影音 / 办公 ——
  { id: "spotify", category: "其他", segment: "media", plan: "Spotify Premium", feeHint: "10.99", recurring: true, syncTier: "none", portalUrl: "https://www.spotify.com/account/", tags: ["影音"], rank: R_OTHER },
  { id: "netflix", category: "其他", segment: "media", plan: "Netflix", feeHint: "15.49", recurring: true, syncTier: "none", portalUrl: "https://www.netflix.com/", tags: ["影音"], rank: R_OTHER + 1 },
  { id: "youtube-premium", category: "其他", segment: "media", plan: "YouTube Premium", feeHint: "13.99", recurring: true, syncTier: "none", portalUrl: "https://www.youtube.com/paid_memberships", tags: ["影音"], rank: R_OTHER + 2 },
  { id: "bilibili-big", category: "其他", segment: "media", plan: "哔哩哔哩大会员", feeHint: "25", recurring: true, syncTier: "none", portalUrl: "https://account.bilibili.com/", tags: ["国内"], rank: R_OTHER + 3 },
  { id: "iqiyi", category: "其他", segment: "media", plan: "爱奇艺会员", feeHint: "30", recurring: true, syncTier: "none", tags: ["国内"], rank: R_OTHER + 4 },
  { id: "office365", category: "其他", segment: "office", plan: "Microsoft 365", feeHint: "69", recurring: true, syncTier: "none", portalUrl: "https://account.microsoft.com/", tags: ["办公"], rank: R_OTHER + 5 },
  { id: "google-one", category: "其他", segment: "office", plan: "Google One", feeHint: "2.99", recurring: true, syncTier: "none", portalUrl: "https://one.google.com/", tags: ["云盘"], rank: R_OTHER + 6 },
  { id: "icloud", category: "其他", segment: "office", plan: "iCloud+", feeHint: "6", recurring: true, syncTier: "none", portalUrl: "https://www.icloud.com/", tags: ["苹果"], rank: R_OTHER + 7 },
  { id: "1password", category: "其他", segment: "office", plan: "1Password", feeHint: "2.99", recurring: true, syncTier: "none", portalUrl: "https://my.1password.com/", tags: ["安全"], rank: R_OTHER + 8 },
  { id: "jetbrains-all", category: "官方", segment: "dev", plan: "JetBrains All Products", feeHint: "24.9", recurring: true, syncTier: "none", portalUrl: "https://account.jetbrains.com/", tags: ["IDE"], rank: R_OTHER + 9 },
];

export function listCatalog(opts?: { segment?: string; q?: string; autoFirst?: boolean }): CatalogEntry[] {
  let list = [...catalogEntries];
  if (opts?.segment && opts.segment !== "all") {
    list = list.filter((e) => e.segment === opts.segment);
  }
  if (opts?.q?.trim()) {
    const q = opts.q.trim().toLowerCase();
    list = list.filter(
      (e) =>
        e.plan.toLowerCase().includes(q) ||
        e.category.includes(q) ||
        (e.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }
  list.sort((a, b) => {
    if (opts?.autoFirst !== false) {
      const tier = (t: CatalogEntry["syncTier"]) => (t === "paste" ? 0 : t === "email" ? 1 : t === "oauth" ? 2 : 3);
      const d = tier(a.syncTier) - tier(b.syncTier);
      if (d !== 0) return d;
    }
    return a.rank - b.rank || a.plan.localeCompare(b.plan, "zh-CN");
  });
  return list;
}

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return catalogEntries.find((e) => e.id === id);
}
