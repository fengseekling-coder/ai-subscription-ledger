import { newId } from "./ids.js";
import type { Bill, SubscriptionRow } from "./types.js";

type RowInput = Partial<SubscriptionRow> & {
  status?: string;
  startDate?: string;
  cycle?: string;
};

export function normalizeRow(row: RowInput): SubscriptionRow {
  const r = { ...row } as RowInput & SubscriptionRow;
  if (!r.id) r.id = newId();
  if (typeof r.subscribed !== "boolean") {
    r.subscribed = String(r.status || "").includes("已有");
  }
  delete r.status;
  delete r.startDate;
  delete r.cycle;
  r.category = String(r.category || "其他").trim();
  r.plan = String(r.plan || "").trim();
  r.fee = String(r.fee ?? "").trim();
  r.usage = String(r.usage ?? "").trim();
  r.dueDate = String(r.dueDate ?? "").trim();
  r.subscribedAt = String(r.subscribedAt ?? "").slice(0, 10);
  r.expired = Boolean(r.expired);
  if (r.segment !== undefined) r.segment = String(r.segment).trim() || undefined;
  if (r.subscribeUrl !== undefined) r.subscribeUrl = String(r.subscribeUrl).trim() || undefined;
  if (r.portalUrl !== undefined) r.portalUrl = String(r.portalUrl).trim() || undefined;
  if (!r.subscribed) {
    r.dueDate = "";
    r.subscribedAt = "";
    r.expired = false;
  }
  return r;
}

export function normalizeBill(b: Partial<Bill>): Bill {
  return {
    id: b.id || newId(),
    subscriptionId: String(b.subscriptionId || ""),
    amount: Number(b.amount) || 0,
    paidAt: String(b.paidAt || "").slice(0, 10),
    orderId: String(b.orderId || "").trim(),
    note: String(b.note || "").trim(),
    kind: b.kind === "renewal" ? "renewal" : "payment",
  };
}