import { looksLikeUsdFee, moneyValue, type BillDraft } from "@ai-sub/core";
import { invoke } from "@tauri-apps/api/core";

export type UsdCnyQuote = {
  rate: number;
  rateDate: string;
  source: string;
};

type SubscriptionChargeBillInput = {
  subscriptionId: string;
  fee: string;
  paidAt: string;
  orderId?: string;
  note?: string;
};

function roundCny(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 将订阅费用变成账单草稿。美元只在这里访问汇率服务，并把结果固化到草稿中；
 * 保存后统计始终读取人民币 amount，不再随“当前汇率”变化。
 */
export async function billDraftFromSubscriptionCharge({
  subscriptionId,
  fee,
  paidAt,
  orderId = "",
  note = "",
}: SubscriptionChargeBillInput): Promise<BillDraft> {
  const originalAmount = moneyValue(fee);
  const base: BillDraft = { subscriptionId, amount: "", paidAt, orderId, note };
  if (!(originalAmount > 0)) return base;

  if (!looksLikeUsdFee(fee)) {
    return {
      ...base,
      amount: String(originalAmount),
      originalAmount,
      originalCurrency: "CNY",
    };
  }

  const quote = await invoke<UsdCnyQuote>("get_usd_cny_rate", { date: paidAt });
  if (!(Number(quote.rate) > 0) || !quote.rateDate) {
    throw new Error("汇率服务未返回有效 USD/CNY 数据");
  }
  return {
    ...base,
    amount: String(roundCny(originalAmount * quote.rate)),
    originalAmount,
    originalCurrency: "USD",
    exchangeRate: quote.rate,
    exchangeRateDate: quote.rateDate,
    exchangeRateSource: quote.source || "Frankfurter / ECB reference rates",
  };
}

export function usdRateSnapshot(quote: UsdCnyQuote) {
  return {
    rate: quote.rate,
    rateDate: quote.rateDate,
    source: quote.source || "Frankfurter / ECB reference rates",
  };
}

/** 为续费流程单独取汇率，避免向服务发送任何订阅内容。 */
export async function getUsdCnyRate(date: string): Promise<UsdCnyQuote> {
  const quote = await invoke<UsdCnyQuote>("get_usd_cny_rate", { date });
  if (!(Number(quote.rate) > 0) || !quote.rateDate) {
    throw new Error("汇率服务未返回有效 USD/CNY 数据");
  }
  return quote;
}
