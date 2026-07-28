export const PURCHASE_CHANNEL_VALUES = ["官方", "中转"] as const;
export type PurchaseChannel = (typeof PURCHASE_CHANNEL_VALUES)[number];

export const BILLING_MODEL_VALUES = ["月付", "年付", "按量计费", "额度包"] as const;
export type BillingModel = (typeof BILLING_MODEL_VALUES)[number];

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
  return billingModel === "月付" || billingModel === "年付";
}
