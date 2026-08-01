import { currentMonthKey, daysUntil } from "./dates.js";
import { isActiveSubscription, isCreditLike, isRowExpired } from "./rules.js";
import type { AppState, Bill, Summary, SubscriptionRow } from "./types.js";

/** 获取指定月份的账单列表（按 paidAt 的前 7 位 YYYY-MM 匹配） */
export function billsForCalendarMonth(bills: Bill[], monthKey?: string): Bill[] {
  const prefix = monthKey || currentMonthKey();
  return bills.filter((b) => String(b.paidAt || "").slice(0, 7) === prefix);
}

/** 仅从账单计算指定月份的支出总额（不从订阅 fee 推算） */
export function monthSpendFromBillsOnly(bills: Bill[], monthKey?: string): number {
  return billsForCalendarMonth(bills, monthKey).reduce((s, b) => s + (Number(b.amount) || 0), 0);
}

/** 获取 3 天内待续费的订阅项列表（按剩余天数升序排序） */
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

/**
 * 计算月度统计摘要
 * @param state 应用状态
 * @param ref 参考日期（默认今天），用于所有与时间相关的计算
 * @returns 包含月度支出、预算、活跃订阅数、临近到期等完整统计数据
 */
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