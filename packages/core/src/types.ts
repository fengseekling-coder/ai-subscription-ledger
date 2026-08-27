/** 账单类型：支付 or 续费 */
export type BillKind = "payment" | "renewal";

/** 账单原始币种。账单 amount 始终以人民币入账。 */
export type BillCurrency = "CNY" | "USD";

/** 订阅分类 */
export type SubscriptionCategory =
  | "AI 服务"
  | "开发工具"
  | "云服务 / VPS"
  | "域名 / 网络"
  | "设计创作"
  | "办公协作"
  | "影音娱乐"
  | "其他";

/** 购买渠道 */
export type PurchaseChannel = "官方" | "中转";

/** 计费方式：额度包与按量计费均无需续费日 */
export type BillingModel = "月付" | "季付" | "年付" | "按量计费" | "额度包";

/** 订阅记录行 */
export interface SubscriptionRow {
  id: string;
  /** 使用场景分类 */
  category: string;
  /** 购买来源 */
  purchaseChannel: PurchaseChannel;
  /** 服务商名称；旧记录为空时由套餐名称推断内置服务商。 */
  provider?: string;
  /** 计费方式 */
  billingModel: BillingModel;
  plan: string;
  fee: string;
  /** 实付金额（可选）。设置后（含 "0"）优先于 fee 作为每周期实际入账金额；空串/未定义 = 未设置，回退用 fee */
  actualFee?: string;
  /** 是否将关联账单计入预算；关闭后账单仍保留在账单列表中。 */
  includeInBudget: boolean;
  /** 首笔订阅账单已经处理过（含用户主动删除），用于防止迁移或启动时重复入账。 */
  initialBillRecorded?: boolean;
  subscribed: boolean;
  dueDate: string;
  subscribedAt: string;
  expired: boolean;
  usage: string;
}

/** 账单 */
export interface Bill {
  id: string;
  subscriptionId: string;
  amount: number;
  paidAt: string;
  orderId: string;
  note: string;
  kind: BillKind;
  /** 账单来源；仅自动创建的订阅首笔账单带有该标记。 */
  source?: "initial";
  /** 原始付款金额；金额栏 amount 始终保存换算后的人民币。 */
  originalAmount?: number;
  originalCurrency?: BillCurrency;
  /** 美元账单在入账时锁定的 USD → CNY 汇率。 */
  exchangeRate?: number;
  /** 汇率数据实际生效的交易日（周末/节假日会回退至最近发布日）。 */
  exchangeRateDate?: string;
  /** 汇率来源，便于账单追溯。 */
  exchangeRateSource?: string;
}

/** 自动监控配置：连接到远程 API 检查订阅状态 */
export interface Monitor {
  id: string;
  type: "api" | "browser";
  apiKey: string;
  serviceId: string;
  lastChecked: string;
  status: "active" | "expired" | "unknown" | "error";
  statusDetail: string;
  remotePlan: string;
  remoteAmount: number;
  remoteRenewalDate: string;
  errorMessage: string;
}

/** 应用状态 */
export interface AppState {
  budget: number;
  rows: SubscriptionRow[];
  bills: Bill[];
  monitors: Monitor[];
  language?: "auto" | "zh-CN" | "en";
  appearance?: AppearancePref;
}

/** 外观偏好 */
export interface AppearancePref {
  mode?: "system" | "light" | "dark";
  accent?: string;
}

/** 统计摘要 */
export interface Summary {
  monthSpend: number;
  budget: number;
  budgetLeft: number;
  budgetPct: number;
  activeCount: number;
  expiredCount: number;
  unsubCount: number;
  nearestPlan: string | null;
  nearestDueDate: string | null;
  nearestLeft: number | null;
  nearestFee: string | null;
  nearestUrgent: boolean;
  pendingRenewCount: number;
  pendingFirstPlan: string | null;
  pendingFirstNote: string | null;
}
