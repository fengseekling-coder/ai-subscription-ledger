import { currentMonthKey, daysUntil } from "./dates.js";
import { isActiveSubscription, isCreditLike, isRowExpired } from "./rules.js";
import type { AppState, Bill, Summary, SubscriptionRow } from "./types.js";

export function billsForCalendarMonth(bills: Bill[], monthKey?: string): Bill[] {
  const prefix = monthKey || currentMonthKey();
  return bills.filter((b) => String(b.paidAt || "").slice(0, 7) === prefix);
}

export function monthSpendFromBillsOnly(bills: Bill[], monthKey?: string): number {
  return billsForCalendarMonth(bills, monthKey).reduce((s, b) => s + (Number(b.amount) || 0), 0);
}

export function pendingRenewItems(rows: SubscriptionRow[], ref = new Date()) {
  return rows
    .map((row, index) => ({ row, index, left: daysUntil(row.dueDate, ref) }))
    .filter(
      ({ row, left }) =>
        isActiveSubscription(row, ref) &&
        row.dueDate &&
        !isCreditLike(row) &&
        left !== null &&
        left >= 0 &&
        left <= 3
    )
    .sort((a, b) => (a.left ?? 0) - (b.left ?? 0));
}

export function computeSummary(state: AppState, ref = new Date()): Summary {
  const mk = currentMonthKey(ref);
  const monthSpend = monthSpendFromBillsOnly(state.bills, mk);
  const budget = Number(state.budget) || 500;
  const left = budget - monthSpend;
  const active = state.rows.filter((r) => isActiveSubscription(r, ref)).length;
  const expiredN = state.rows.filter((r) => r.subscribed && isRowExpired(r, ref)).length;
  const unsub = state.rows.filter((r) => !r.subscribed).length;

  const budgetPct =
    budget > 0 ? Math.min(100, (monthSpend / budget) * 100) : monthSpend > 0 ? 100 : 0;

  const dueCandidates = state.rows
    .filter((row) => isActiveSubscription(row, ref) && row.dueDate && !isCreditLike(row))
    .map((row) => ({ row, left: daysUntil(row.dueDate, ref) }))
    .sort((a, b) => (a.left ?? 999999) - (b.left ?? 999999));

  const nearest = dueCandidates[0];
  const pending = pendingRenewItems(state.rows, ref);

  return {
    monthSpend,
    budget,
    budgetLeft: left,
    budgetPct,
    activeCount: active,
    expiredCount: expiredN,
    unsubCount: unsub,
    nearestPlan: nearest?.row.plan ?? null,
    nearestDueDate: nearest?.row.dueDate ?? null,
    nearestLeft: nearest?.left ?? null,
    nearestFee: nearest?.row.fee ? String(nearest.row.fee) : null,
    nearestUrgent: Boolean(nearest && nearest.left !== null && nearest.left >= 0 && nearest.left <= 3),
    pendingRenewCount: pending.length,
    pendingFirstPlan: pending[0]?.row.plan ?? null,
    pendingFirstNote: pending[0]
      ? `${pending[0].row.dueDate} · 剩余 ${pending[0].left} 天`
      : null,
  };
}