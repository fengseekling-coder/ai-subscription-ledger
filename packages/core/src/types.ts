export type BillKind = "payment" | "renewal";

export interface SubscriptionRow {
  id: string;
  category: string;
  plan: string;
  fee: string;
  subscribed: boolean;
  dueDate: string;
  subscribedAt: string;
  expired: boolean;
  usage: string;
  segment?: string;
  subscribeUrl?: string;
  portalUrl?: string;
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

export interface AppState {
  budget: number;
  rows: SubscriptionRow[];
  bills: Bill[];
  /** UI language preference; "auto" follows system locale. */
  language?: "auto" | "zh-CN" | "en";
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