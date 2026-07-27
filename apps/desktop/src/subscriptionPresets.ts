export const SUBSCRIPTION_CATEGORY_VALUES = [
  "AI 服务",
  "开发工具",
  "云服务 / VPS",
  "域名 / 网络",
  "设计创作",
  "办公协作",
  "影音娱乐",
  "其他",
] as const;

export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORY_VALUES)[number];

export const PURCHASE_CHANNEL_VALUES = ["官方", "中转"] as const;
export type PurchaseChannel = (typeof PURCHASE_CHANNEL_VALUES)[number];

export const BILLING_MODEL_VALUES = ["月付", "年付", "按量计费", "额度包"] as const;
export type BillingModel = (typeof BILLING_MODEL_VALUES)[number];

export const SUBSCRIPTION_PRESET_GROUPS = [
  "对话与助手",
  "AI 编程",
  "创作与媒体",
  "模型 API",
] as const;
export type SubscriptionPresetGroup = (typeof SUBSCRIPTION_PRESET_GROUPS)[number];

export type SubscriptionPreset = {
  id: string;
  group: SubscriptionPresetGroup;
  plan: string;
  category: SubscriptionCategory;
  purchaseChannel: PurchaseChannel;
  billingModel: BillingModel;
  fee: string;
};

/**
 * 这里是表单预填数据，不是可浏览的服务目录。价格仅作输入起点，
 * 最终金额以用户实际账单和地区税费为准。
 */
export const AI_SUBSCRIPTION_PRESETS: readonly SubscriptionPreset[] = [
  // Prices are optional input seeds. They are intentionally not used for calculations until saved.
  { id: "chatgpt-plus", group: "对话与助手", plan: "ChatGPT Plus", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$20" },
  { id: "chatgpt-pro", group: "对话与助手", plan: "ChatGPT Pro", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$200" },
  { id: "chatgpt-business-annual", group: "对话与助手", plan: "ChatGPT Business（年付）", category: "AI 服务", purchaseChannel: "官方", billingModel: "年付", fee: "US$300" },
  { id: "claude-pro", group: "对话与助手", plan: "Claude Pro", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$20" },
  { id: "claude-max-5x", group: "对话与助手", plan: "Claude Max 5x", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$100" },
  { id: "claude-max-20x", group: "对话与助手", plan: "Claude Max 20x", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$200" },
  { id: "google-ai-pro", group: "对话与助手", plan: "Google AI Pro", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$19.99" },
  { id: "google-ai-ultra", group: "对话与助手", plan: "Google AI Ultra", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$249.99" },
  { id: "perplexity-pro", group: "对话与助手", plan: "Perplexity Pro", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$20" },
  { id: "perplexity-max", group: "对话与助手", plan: "Perplexity Max", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$200" },
  { id: "microsoft-copilot-pro", group: "对话与助手", plan: "Microsoft Copilot Pro", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$20" },
  { id: "poe-premium", group: "对话与助手", plan: "Poe Premium", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$19.99" },
  { id: "grok-supergrok", group: "对话与助手", plan: "SuperGrok", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "US$30" },
  { id: "kimi-membership", group: "对话与助手", plan: "Kimi 会员", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "" },
  { id: "minimax-membership", group: "对话与助手", plan: "MiniMax 会员", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "" },
  { id: "yuanbao-membership", group: "对话与助手", plan: "腾讯元宝会员", category: "AI 服务", purchaseChannel: "官方", billingModel: "月付", fee: "" },

  { id: "cursor-pro", group: "AI 编程", plan: "Cursor Pro", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$20" },
  { id: "cursor-pro-plus", group: "AI 编程", plan: "Cursor Pro+", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$60" },
  { id: "cursor-ultra", group: "AI 编程", plan: "Cursor Ultra", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$200" },
  { id: "github-copilot-pro", group: "AI 编程", plan: "GitHub Copilot Pro", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$10" },
  { id: "github-copilot-pro-plus", group: "AI 编程", plan: "GitHub Copilot Pro+", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$39" },
  { id: "windsurf-pro", group: "AI 编程", plan: "Windsurf Pro", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$15" },
  { id: "windsurf-teams", group: "AI 编程", plan: "Windsurf Teams", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$30" },
  { id: "jetbrains-ai-pro", group: "AI 编程", plan: "JetBrains AI Pro", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$10" },
  { id: "amazon-q-pro", group: "AI 编程", plan: "Amazon Q Developer Pro", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$19" },
  { id: "replit-core", group: "AI 编程", plan: "Replit Core", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$25" },
  { id: "lovable-pro", group: "AI 编程", plan: "Lovable Pro", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$25" },
  { id: "bolt-pro", group: "AI 编程", plan: "Bolt Pro", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$20" },
  { id: "v0-premium", group: "AI 编程", plan: "v0 Premium", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$20" },
  { id: "tabnine-dev", group: "AI 编程", plan: "Tabnine Dev", category: "开发工具", purchaseChannel: "官方", billingModel: "月付", fee: "US$9" },

  { id: "midjourney-basic", group: "创作与媒体", plan: "Midjourney Basic", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$10" },
  { id: "midjourney-standard", group: "创作与媒体", plan: "Midjourney Standard", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$30" },
  { id: "midjourney-pro", group: "创作与媒体", plan: "Midjourney Pro", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$60" },
  { id: "midjourney-mega", group: "创作与媒体", plan: "Midjourney Mega", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$120" },
  { id: "runway-standard", group: "创作与媒体", plan: "Runway Standard", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$15" },
  { id: "runway-pro", group: "创作与媒体", plan: "Runway Pro", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$35" },
  { id: "runway-unlimited", group: "创作与媒体", plan: "Runway Unlimited", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$95" },
  { id: "elevenlabs-starter", group: "创作与媒体", plan: "ElevenLabs Starter", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$5" },
  { id: "elevenlabs-creator", group: "创作与媒体", plan: "ElevenLabs Creator", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$22" },
  { id: "elevenlabs-pro", group: "创作与媒体", plan: "ElevenLabs Pro", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$99" },
  { id: "suno-pro", group: "创作与媒体", plan: "Suno Pro", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$10" },
  { id: "suno-premier", group: "创作与媒体", plan: "Suno Premier", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$30" },
  { id: "adobe-firefly-standard", group: "创作与媒体", plan: "Adobe Firefly Standard", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$9.99" },
  { id: "canva-pro", group: "创作与媒体", plan: "Canva Pro", category: "设计创作", purchaseChannel: "官方", billingModel: "月付", fee: "US$15" },
  { id: "notion-ai", group: "创作与媒体", plan: "Notion AI", category: "办公协作", purchaseChannel: "官方", billingModel: "月付", fee: "US$10" },

  { id: "openai-api", group: "模型 API", plan: "OpenAI API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "claude-api", group: "模型 API", plan: "Claude API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "gemini-api", group: "模型 API", plan: "Gemini API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "perplexity-api", group: "模型 API", plan: "Perplexity API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "xai-api", group: "模型 API", plan: "xAI API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "mistral-api", group: "模型 API", plan: "Mistral API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "cohere-api", group: "模型 API", plan: "Cohere API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "groqcloud-api", group: "模型 API", plan: "GroqCloud API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "together-api", group: "模型 API", plan: "Together AI API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "fireworks-api", group: "模型 API", plan: "Fireworks AI API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "replicate-api", group: "模型 API", plan: "Replicate API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "openrouter-api", group: "模型 API", plan: "OpenRouter API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "hugging-face-api", group: "模型 API", plan: "Hugging Face API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "deepseek-api", group: "模型 API", plan: "DeepSeek API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "moonshot-api", group: "模型 API", plan: "Moonshot AI API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "minimax-api", group: "模型 API", plan: "MiniMax API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "doubao-api", group: "模型 API", plan: "豆包模型 API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "qwen-api", group: "模型 API", plan: "阿里百炼 Qwen API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "qianfan-api", group: "模型 API", plan: "百度千帆 API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "bigmodel-api", group: "模型 API", plan: "智谱 BigModel API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
  { id: "hunyuan-api", group: "模型 API", plan: "腾讯混元 API", category: "AI 服务", purchaseChannel: "官方", billingModel: "按量计费", fee: "" },
];

const LEGACY_CATEGORY_DEFAULTS: Record<
  string,
  { category: SubscriptionCategory; purchaseChannel: PurchaseChannel; billingModel: BillingModel }
> = {
  官方: { category: "AI 服务", purchaseChannel: "官方", billingModel: "月付" },
  中转: { category: "AI 服务", purchaseChannel: "中转", billingModel: "月付" },
  中转额度包: { category: "AI 服务", purchaseChannel: "中转", billingModel: "额度包" },
};

export function formDefaultsFromCategory(category: string): {
  category: string;
  purchaseChannel: PurchaseChannel;
  billingModel: BillingModel;
} {
  return LEGACY_CATEGORY_DEFAULTS[category] ?? {
    category: category || "其他",
    purchaseChannel: "官方",
    billingModel: "月付",
  };
}

export function billingModelNeedsDueDate(billingModel: BillingModel): boolean {
  return billingModel === "月付" || billingModel === "年付";
}
