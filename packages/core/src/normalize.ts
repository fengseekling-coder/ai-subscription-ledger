import { newId } from "./ids.js";
import type {
  Bill,
  BillingModel,
  PurchaseChannel,
  SubscriptionCategory,
  SubscriptionRow,
} from "./types.js";

type RowInput = Partial<SubscriptionRow> & {
  status?: string;
  startDate?: string;
  cycle?: string;
  segment?: string;
  subscribeUrl?: string;
  portalUrl?: string;
};

const CATEGORIES = new Set<SubscriptionCategory>([
  "AI 服务",
  "开发工具",
  "云服务 / VPS",
  "域名 / 网络",
  "设计创作",
  "办公协作",
  "影音娱乐",
  "其他",
]);

const PURCHASE_CHANNELS = new Set<PurchaseChannel>(["官方", "中转"]);
const BILLING_MODELS = new Set<BillingModel>(["月付", "季付", "年付", "按量计费", "额度包"]);

function inferCategory(raw: string, plan: string, legacySegment: string): string {
  if (CATEGORIES.has(raw as SubscriptionCategory)) return raw;
  if (legacySegment === "dev") return "开发工具";
  if (legacySegment === "cloud") return "云服务 / VPS";
  if (legacySegment === "design") return "设计创作";
  if (legacySegment === "office") return "办公协作";
  if (legacySegment === "media") return "影音娱乐";
  if (legacySegment === "ai" || raw === "官方" || raw === "中转" || raw === "中转额度包") {
    return "AI 服务";
  }
  if (/(ChatGPT|Claude|Gemini|Grok|Perplexity|Midjourney|Runway|Suno|ElevenLabs|Kimi|DeepSeek|豆包|通义|文心|AI)/i.test(plan)) {
    return "AI 服务";
  }
  return raw || "其他";
}

function inferPurchaseChannel(raw: unknown, legacyCategory: string, legacySegment: string): PurchaseChannel {
  const value = String(raw ?? "").trim();
  if (PURCHASE_CHANNELS.has(value as PurchaseChannel)) return value as PurchaseChannel;
  return legacyCategory.includes("中转") || legacySegment === "relay" || legacySegment === "credit"
    ? "中转"
    : "官方";
}

function inferBillingModel(
  raw: unknown,
  legacyCategory: string,
  plan: string,
  legacySegment: string,
  legacyCycle: string
): BillingModel {
  const value = String(raw ?? "").trim();
  if (BILLING_MODELS.has(value as BillingModel)) return value as BillingModel;
  if (
    legacySegment === "credit" ||
    legacyCategory.includes("额度包") ||
    /额度包|credit pack|credits/i.test(plan)
  ) {
    return "额度包";
  }
  if (/按量|用量|pay.?as.?you.?go|usage/i.test(plan) || legacyCycle.includes("按量")) {
    return "按量计费";
  }
  if (/季付|quarter/i.test(plan) || legacyCycle.includes("季")) return "季付";
  if (/年付|annual|year/i.test(plan) || legacyCycle.includes("年")) return "年付";
  return "月付";
}

export function normalizeRow(row: RowInput): SubscriptionRow {
  const r = { ...row } as RowInput & SubscriptionRow;
  if (!r.id) r.id = newId();
  if (typeof r.subscribed !== "boolean") {
    r.subscribed = String(r.status || "").includes("已有");
  }
  delete r.status;
  delete r.startDate;
  const legacyCycle = String(r.cycle ?? "");
  delete r.cycle;
  const legacyCategory = String(r.category || "").trim();
  const legacySegment = String(r.segment || "").trim();
  delete r.segment;
  delete r.subscribeUrl;
  delete r.portalUrl;
  r.plan = String(r.plan || "").trim();
  r.category = inferCategory(legacyCategory, r.plan, legacySegment);
  r.purchaseChannel = inferPurchaseChannel(r.purchaseChannel, legacyCategory, legacySegment);
  r.provider = String(r.provider ?? "").trim();
  r.billingModel = inferBillingModel(
    r.billingModel,
    legacyCategory,
    r.plan,
    legacySegment,
    legacyCycle
  );
  r.fee = String(r.fee ?? "").trim();
  r.actualFee = String(r.actualFee ?? "").trim();
  // 旧数据没有这个字段时沿用原来的行为：所有关联账单都计入预算。
  // 同时兼容早期导入中可能出现的字符串布尔值。
  r.includeInBudget =
    r.includeInBudget !== false && String(r.includeInBudget ?? "").trim().toLowerCase() !== "false";
  r.initialBillRecorded =
    r.initialBillRecorded === true ||
    String(r.initialBillRecorded ?? "").trim().toLowerCase() === "true";
  r.usage = String(r.usage ?? "").trim();
  r.dueDate = String(r.dueDate ?? "").trim();
  r.subscribedAt = String(r.subscribedAt ?? "").slice(0, 10);
  r.expired = Boolean(r.expired);
  if (r.billingModel === "额度包" || r.billingModel === "按量计费") {
    r.dueDate = "";
  }
  // 空续费日期表示不限时间；兼容清理旧数据中残留的过期标记。
  if (!r.dueDate) r.expired = false;
  if (!r.subscribed) {
    r.dueDate = "";
    r.subscribedAt = "";
    r.expired = false;
  }
  return r;
}

export function normalizeBill(b: Partial<Bill>): Bill {
  const source = b.source === "initial" ? "initial" : undefined;
  const originalCurrency = b.originalCurrency === "USD" || b.originalCurrency === "CNY"
    ? b.originalCurrency
    : undefined;
  const originalAmount = Number(b.originalAmount);
  const exchangeRate = Number(b.exchangeRate);
  return {
    id: b.id || newId(),
    subscriptionId: String(b.subscriptionId || ""),
    amount: Number(b.amount) || 0,
    paidAt: String(b.paidAt || "").slice(0, 10),
    orderId: String(b.orderId || "").trim(),
    note: String(b.note || "").trim(),
    kind: b.kind === "renewal" ? "renewal" : "payment",
    ...(source ? { source } : {}),
    ...(originalCurrency && Number.isFinite(originalAmount) && originalAmount >= 0
      ? { originalCurrency, originalAmount }
      : {}),
    ...(originalCurrency === "USD" && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? {
          exchangeRate,
          exchangeRateDate: String(b.exchangeRateDate || "").slice(0, 10),
          exchangeRateSource: String(b.exchangeRateSource || "").trim(),
        }
      : {}),
  };
}
