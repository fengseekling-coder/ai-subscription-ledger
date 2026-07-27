import { daysUntil } from "./dates.js";
import { moneyValue } from "./money.js";
import type { SubscriptionRow } from "./types.js";

export function isCreditLike(row: SubscriptionRow): boolean {
  return row.billingModel === "额度包" || row.billingModel === "按量计费";
}

export function isRecurringFee(row: SubscriptionRow): boolean {
  if (!row.subscribed || isCreditLike(row)) return false;
  return moneyValue(row.fee) > 0 || /^\s*0\s*$/.test(String(row.fee || ""));
}

export function needsDueDate(row: SubscriptionRow, ref = new Date()): boolean {
  return isActiveSubscription(row, ref) && isRecurringFee(row) && !isCreditLike(row);
}

export function isRowExpired(row: SubscriptionRow, ref = new Date()): boolean {
  if (!row.subscribed) return false;
  if (row.expired) return true;
  if (row.dueDate && daysUntil(row.dueDate, ref)! < 0) return true;
  return false;
}

export function isActiveSubscription(row: SubscriptionRow, ref = new Date()): boolean {
  return row.subscribed && !isRowExpired(row, ref);
}

export function categoryClass(category: string): string {
  const s = String(category || "");
  if (s.includes("AI")) return "ai";
  if (s.includes("开发")) return "dev";
  if (s.includes("云服务") || s.includes("VPS") || s.includes("域名") || s.includes("网络")) {
    return "cloud";
  }
  if (s.includes("设计")) return "design";
  if (s.includes("办公")) return "office";
  if (s.includes("影音")) return "media";
  return "other";
}

export function categoryRank(category: string): number {
  const s = String(category || "");
  if (s.includes("AI")) return 0;
  if (s.includes("开发")) return 1;
  if (s.includes("云服务") || s.includes("VPS")) return 2;
  if (s.includes("域名") || s.includes("网络")) return 3;
  if (s.includes("设计")) return 4;
  if (s.includes("办公")) return 5;
  if (s.includes("影音")) return 6;
  return 7;
}

export function rowSortKey(row: SubscriptionRow, ref = new Date()) {
  if (!row.subscribed) return { tier: 2, urgency: 999999 };
  if (isRowExpired(row, ref)) return { tier: 3, urgency: 999997 };
  const left = daysUntil(row.dueDate, ref);
  if (left === null) return { tier: 1, urgency: 999998 };
  // Sort by urgency (days remaining), negative values (overdue) come first
  return { tier: 0, urgency: left ?? 0 };
}

export function sortRowEntries<T extends { row: SubscriptionRow }>(entries: T[], ref = new Date()): T[] {
  // slice() 后再排：Array.sort 原地改数组，直接排会把调用方传进来的数组一起改掉
  // （sortedBills 一直是这么做的，这里之前漏了）。
  return entries.slice().sort((a, b) => {
    const ka = rowSortKey(a.row, ref);
    const kb = rowSortKey(b.row, ref);
    if (ka.tier !== kb.tier) return ka.tier - kb.tier;
    if (ka.urgency !== kb.urgency) return ka.urgency - kb.urgency;
    const cat = categoryRank(a.row.category) - categoryRank(b.row.category);
    if (cat !== 0) return cat;
    return String(a.row.plan).localeCompare(String(b.row.plan), "zh-CN");
  });
}
