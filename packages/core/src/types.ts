export type BillKind = "payment" | "renewal";

export type SubscriptionCategory =
  | "AI 服务"
  | "开发工具"
  | "云服务 / VPS"
  | "域名 / 网络"
  | "设计创作"
  | "办公协作"
  | "影音娱乐"
  | "其他";

export type PurchaseChannel = "官方" | "中转";

export type BillingModel = "月付" | "年付" | "按量计费" | "额度包";

export interface SubscriptionRow {
  id: string;
  /** 使用场景分类。旧数据中的“官方/中转/中转额度包”会在 normalizeRow 中兼容迁移。 */
  category: string;
  /** 购买来源，与 category 分开，避免“AI 服务”和“官方”混成同一个概念。 */
  purchaseChannel: PurchaseChannel;
  /** 计费方式。额度包与按量计费均不要求续费日。 */
  billingModel: BillingModel;
  plan: string;
  fee: string;
  subscribed: boolean;
  dueDate: string;
  subscribedAt: string;
  expired: boolean;
  usage: string;
}

export interface Bill {
  id: string;
  subscriptionId: string;
  amount: number;
  paidAt: string;
  orderId: string;
  note: string;
  kind: BillKind;
}

/** 自动监控：连接到远程 API 检查订阅状态 */
export interface Monitor {
  id: string;
  /** 监控类型：api = 通过官方 API 查询；browser = 浏览器自动化（预留） */
  type: "api" | "browser";
  /** API Key（明文存储于内存，落盘时由 db.rs 做 AES-256-GCM 加密） */
  apiKey: string;
  /** 服务端点标识，如 "openai", "anthropic", "cursor" */
  serviceId: string;
  /** 上次检查时间 ISO */
  lastChecked: string;
  /** 当前状态 */
  status: "active" | "expired" | "unknown" | "error";
  /** 状态说明文字 */
  statusDetail: string;
  /** 远端返回的套餐名 */
  remotePlan: string;
  /** 远端返回的金额（分） */
  remoteAmount: number;
  /** 远端返回的续费日 */
  remoteRenewalDate: string;
  /** 最后一次查询的错误信息 */
  errorMessage: string;
}

export interface AppState {
  budget: number;
  rows: SubscriptionRow[];
  bills: Bill[];
  /** 自动监控列表 */
  monitors: Monitor[];
  /** UI language preference; "auto" follows system locale. */
  language?: "auto" | "zh-CN" | "en";
  /** 外观偏好：主题模式 + 强调色 */
  appearance?: AppearancePref;
}

/** 外观偏好。mode 默认跟随系统；accent 为强调色键名（由前端 theme 模块解释）。 */
export interface AppearancePref {
  mode?: "system" | "light" | "dark";
  accent?: string;
}

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
