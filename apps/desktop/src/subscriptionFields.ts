export const PURCHASE_CHANNEL_VALUES = ["官方", "中转"] as const;
export type PurchaseChannel = (typeof PURCHASE_CHANNEL_VALUES)[number];

export const BILLING_MODEL_VALUES = ["月付", "季付", "年付", "按量计费", "额度包"] as const;
export type BillingModel = (typeof BILLING_MODEL_VALUES)[number];

/** 服务商内置套餐预设 */
export interface ProviderPlan {
  name: string;
  /** 按人数计价（团队版），prices 为单人单价 */
  perSeat?: boolean;
  /** 各计费周期的价格（团队版为单人价）；未列出的周期由月付推导（季付×3、年付×12） */
  prices: Partial<Record<BillingModel, string>>;
}

export interface Provider {
  id: string;
  label: string;
  plans: ProviderPlan[];
}

/** “其他”服务商（自定义输入）的特殊值 */
export const OTHER_PROVIDER = "other";
/** 套餐下拉中“自定义…”选项的特殊值 */
export const CUSTOM_PLAN_VALUE = "__custom__";

export const PROVIDERS: Provider[] = [
  {
    id: "openai",
    label: "OpenAI",
    plans: [
      { name: "ChatGPT Go", prices: { 月付: "8" } },
      { name: "ChatGPT Plus", prices: { 月付: "20", 年付: "200" } },
      { name: "ChatGPT Pro", prices: { 月付: "200", 年付: "2000" } },
      { name: "ChatGPT Team", perSeat: true, prices: { 月付: "25", 年付: "240" } },
    ],
  },
  {
    id: "claude",
    label: "Claude",
    plans: [
      { name: "Claude Pro", prices: { 月付: "20", 年付: "200" } },
      { name: "Claude Max 5x", prices: { 月付: "100", 年付: "1000" } },
      { name: "Claude Max 20x", prices: { 月付: "200", 年付: "2000" } },
      { name: "Claude Team", perSeat: true, prices: { 月付: "25", 年付: "240" } },
    ],
  },
  {
    id: "google",
    label: "Google",
    plans: [
      { name: "Google AI Pro", prices: { 月付: "20", 年付: "200" } },
      { name: "Google AI Ultra", prices: { 月付: "250", 年付: "2500" } },
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    plans: [
      { name: "Cursor Pro", prices: { 月付: "20", 年付: "192" } },
      { name: "Cursor Ultra", prices: { 月付: "200", 年付: "1920" } },
      { name: "Cursor Teams", perSeat: true, prices: { 月付: "40", 年付: "384" } },
    ],
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    plans: [
      { name: "Copilot Pro", prices: { 月付: "10", 年付: "100" } },
      { name: "Copilot Pro+", prices: { 月付: "39", 年付: "390" } },
      { name: "Copilot Business", perSeat: true, prices: { 月付: "19", 年付: "190" } },
    ],
  },
  {
    id: "midjourney",
    label: "Midjourney",
    plans: [
      { name: "Midjourney Basic", prices: { 月付: "10", 年付: "96" } },
      { name: "Midjourney Standard", prices: { 月付: "30", 年付: "288" } },
      { name: "Midjourney Pro", prices: { 月付: "60", 年付: "576" } },
    ],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    plans: [
      { name: "Perplexity Pro", prices: { 月付: "20", 年付: "200" } },
      { name: "Perplexity Enterprise Pro", perSeat: true, prices: { 月付: "40", 年付: "400" } },
    ],
  },
  {
    id: "grok",
    label: "Grok (xAI)",
    plans: [
      { name: "SuperGrok Lite", prices: { 月付: "10" } },
      { name: "SuperGrok", prices: { 月付: "30", 年付: "300" } },
    ],
  },
  {
    id: "windsurf",
    label: "Windsurf",
    plans: [
      { name: "Windsurf Pro", prices: { 月付: "15", 年付: "144" } },
      { name: "Windsurf Teams", perSeat: true, prices: { 月付: "30", 年付: "288" } },
    ],
  },
];

/** 套餐首选计费周期（prices 的第一个键） */
export function firstCycleOf(plan: ProviderPlan): BillingModel {
  return (Object.keys(plan.prices)[0] as BillingModel | undefined) ?? "月付";
}

/** 某计费周期的单价；无显式价时由月付推导（季付×3、年付×12），无法计算返回 null */
export function priceForCycle(plan: ProviderPlan, cycle: BillingModel): number | null {
  const explicit = plan.prices[cycle];
  if (explicit) return Number(explicit);
  const monthly = plan.prices["月付"];
  if (monthly) {
    const m = Number(monthly);
    if (cycle === "季付") return m * 3;
    if (cycle === "年付") return m * 12;
  }
  return null;
}

/** 套餐在某周期下的总价（团队版乘人数） */
export function totalPriceForCycle(plan: ProviderPlan, cycle: BillingModel, seats: number): number | null {
  const unit = priceForCycle(plan, cycle);
  if (unit === null) return null;
  return plan.perSeat ? unit * Math.max(1, seats) : unit;
}

/**
 * 年付折扣信息：仅当套餐同时有月付与显式年付价、且年付低于月付×12 时返回。
 * 用于在计费方式下拉里提示“年付（省 N%）”，避免用户误以为是 月价×12 算错。
 */
export function annualSaving(plan: ProviderPlan): { percentOff: number } | null {
  const monthly = plan.prices["月付"];
  const annual = plan.prices["年付"];
  if (!monthly || !annual) return null;
  const full = Number(monthly) * 12;
  const actual = Number(annual);
  if (!(full > 0) || actual >= full) return null;
  return { percentOff: Math.round((1 - actual / full) * 100) };
}

const SEAT_PLAN_RE = /^(.*?)（(\d+)人）$/;

/** 解析 "ChatGPT Team（5人）" 形式的套餐名；非人数套餐返回 null */
export function parseSeatPlan(plan: string): { name: string; seats: number } | null {
  const m = plan.trim().match(SEAT_PLAN_RE);
  if (!m) return null;
  return { name: m[1], seats: Number(m[2]) };
}

/** 根据套餐名推断服务商；无匹配返回 null */
export function inferProviderFromPlan(plan: string): string | null {
  const lower = plan.trim().toLowerCase();
  if (!lower) return null;
  for (const p of PROVIDERS) {
    if (p.plans.some((pp) => pp.name.toLowerCase() === lower)) return p.id;
  }
  if (/chatgpt|openai|gpt/.test(lower)) return "openai";
  if (/claude|anthropic/.test(lower)) return "claude";
  if (/gemini|google|youtube/.test(lower)) return "google";
  if (/cursor/.test(lower)) return "cursor";
  if (/copilot/.test(lower)) return "copilot";
  if (/midjourney/.test(lower)) return "midjourney";
  if (/perplexity/.test(lower)) return "perplexity";
  if (/grok/.test(lower)) return "grok";
  if (/windsurf/.test(lower)) return "windsurf";
  return null;
}

/** 表单默认服务商：空套餐用第一个预设，有套餐则推断（忽略人数后缀） */
export function defaultProviderForPlan(plan: string): string {
  const base = parseSeatPlan(plan)?.name ?? plan;
  if (!base.trim()) return PROVIDERS[0].id;
  return inferProviderFromPlan(base) ?? OTHER_PROVIDER;
}

/** 套餐字段是否应显示自定义输入（而非内置下拉；人数后缀不影响判断） */
export function isCustomPlanMode(plan: string): boolean {
  const base = parseSeatPlan(plan)?.name ?? plan;
  if (!base.trim()) return false;
  const pid = inferProviderFromPlan(base);
  if (!pid) return true;
  const provider = PROVIDERS.find((p) => p.id === pid);
  return !provider?.plans.some((pp) => pp.name === base);
}

const LEGACY_CATEGORY_DEFAULTS: Record<
  string,
  { category: string; purchaseChannel: PurchaseChannel; billingModel: BillingModel }
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
  return billingModel === "月付" || billingModel === "季付" || billingModel === "年付";
}

const PROVIDER_DEFAULT_CATEGORY: Record<string, string> = {
  openai: "AI 服务",
  claude: "AI 服务",
  google: "AI 服务",
  grok: "AI 服务",
  perplexity: "AI 服务",
  midjourney: "设计创作",
  cursor: "开发工具",
  copilot: "开发工具",
  windsurf: "开发工具",
};

/** 新增订阅按服务商给默认分类；未匹配到内置服务商时归「其他」。 */
export function defaultCategoryForProvider(providerName: string): string {
  const normalized = providerName.trim().toLowerCase();
  if (!normalized) return "其他";
  const provider = PROVIDERS.find(
    (item) => item.id.toLowerCase() === normalized || item.label.toLowerCase() === normalized
  );
  if (!provider) return "其他";
  return PROVIDER_DEFAULT_CATEGORY[provider.id] ?? "AI 服务";
}
