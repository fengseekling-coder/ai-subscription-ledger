import { billsForCalendarMonth, monthSpendFromBillsOnly } from "./stats.js";
import { categoryClass, isActiveSubscription } from "./rules.js";
import { moneyValue } from "./money.js";
import type { AppState, Bill } from "./types.js";

export type CategorySpendRow = {
  category: string;
  cls: string;
  count: number;
  activeCount: number;
  monthSpend: number;
  feeMonthlyEst: number;
};

export type MonthSpendRow = {
  monthKey: string;
  label: string;
  total: number;
  billCount: number;
};

export function spendByCategory(state: AppState, monthKey?: string): CategorySpendRow[] {
  const mk = monthKey;
  const monthBills = billsForCalendarMonth(state.bills, mk);
  const subById = new Map(state.rows.map((r) => [r.id, r]));
  const agg = new Map<string, { spend: number; ids: Set<string> }>();

  for (const b of monthBills) {
    const sub = subById.get(b.subscriptionId);
    const cat = sub?.category?.trim() || "（未关联）";
    const cur = agg.get(cat) ?? { spend: 0, ids: new Set<string>() };
    cur.spend += Number(b.amount) || 0;
    if (sub) cur.ids.add(sub.id);
    agg.set(cat, cur);
  }

  const ref = new Date();
  const rows: CategorySpendRow[] = [];
  const categories = new Set<string>();
  state.rows.forEach((r) => categories.add(r.category?.trim() || "其他"));
  monthBills.forEach((b) => {
    const sub = subById.get(b.subscriptionId);
    categories.add(sub?.category?.trim() || "（未关联）");
  });

  for (const category of categories) {
    const spend = agg.get(category)?.spend ?? 0;
    const subs = state.rows.filter((r) => (r.category?.trim() || "其他") === category);
    const activeCount = subs.filter((r) => isActiveSubscription(r, ref)).length;
    const feeMonthlyEst = subs
      .filter((r) => isActiveSubscription(r, ref))
      .reduce((s, r) => s + moneyValue(r.fee), 0);
    rows.push({
      category,
      cls: categoryClass(category),
      count: subs.length,
      activeCount,
      monthSpend: spend,
      feeMonthlyEst,
    });
  }

  return rows.sort((a, b) => b.monthSpend - a.monthSpend || b.feeMonthlyEst - a.feeMonthlyEst);
}

export function spendByMonth(state: AppState, lastN = 6, ref = new Date()): MonthSpendRow[] {
  const out: MonthSpendRow[] = [];
  for (let i = 0; i < lastN; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bills = billsForCalendarMonth(state.bills, monthKey);
    const total = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    out.push({
      monthKey,
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
      total,
      billCount: bills.length,
    });
  }
  return out;
}

export function billsForCategory(state: AppState, category: string, monthKey?: string): Bill[] {
  const subById = new Map(state.rows.map((r) => [r.id, r]));
  return billsForCalendarMonth(state.bills, monthKey).filter((b) => {
    const sub = subById.get(b.subscriptionId);
    const cat = sub?.category?.trim() || "（未关联）";
    return cat === category;
  });
}

export function totalMonthSpend(state: AppState, monthKey?: string): number {
  return monthSpendFromBillsOnly(state.bills, monthKey);
}