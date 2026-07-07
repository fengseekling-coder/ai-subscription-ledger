import { daysUntil } from "./dates.js";
import { moneyValue } from "./money.js";
import type { SubscriptionRow } from "./types.js";

export function isCreditLike(row: SubscriptionRow): boolean {
  if (row.segment === "credit") return true;
  if (row.segment && row.segment !== "credit") return false;
  const c = String(row.category || "");
  const p = String(row.plan || "");
  if (c.includes("额度包")) return true;
  if (p.includes("不限时") || p.includes("Credits")) return true;
  if (p.includes("额度") && !/月卡|月会员|Plus|Pro|Medium|会员/.test(p)) return true;
  return false;
}

export function isRecurringFee(row: SubscriptionRow): boolean {
  if (!row.subscribed || isCreditLike(row)) return false;
  return moneyValue(row.fee) > 0 || /^\s*0\s*$/.test(String(row.fee || ""));
}

export function needsDueDate(row: SubscriptionRow): boolean {
  return isActiveSubscription(row) && isRecurringFee(row) && !isCreditLike(row);
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
  if (s.includes("额度")) return "credit";
  if (s.includes("官方")) return "official";
  if (s.includes("中转")) return "relay";
  return "other";
}

export function categoryRank(category: string): number {
  const s = String(category || "");
  if (s.includes("官方")) return 0;
  if (s.includes("中转") && !s.includes("额度")) return 1;
  if (s.includes("额度")) return 2;
  return 3;
}

export function rowSortKey(row: SubscriptionRow, ref = new Date()) {
  if (!row.subscribed) return { tier: 2, urgency: 999999 };
  if (isRowExpired(row, ref)) return { tier: 3, urgency: 999997 };
  const left = daysUntil(row.dueDate, ref);
  if (left === null) return { tier: 1, urgency: 999998 };
  if (left < 0) return { tier: 0, urgency: left };
  return { tier: 0, urgency: left };
}

export function sortRowEntries<T extends { row: SubscriptionRow }>(entries: T[], ref = new Date()): T[] {
  return entries.sort((a, b) => {
    const ka = rowSortKey(a.row, ref);
    const kb = rowSortKey(b.row, ref);
    if (ka.tier !== kb.tier) return ka.tier - kb.tier;
    if (ka.urgency !== kb.urgency) return ka.urgency - kb.urgency;
    const cat = categoryRank(a.row.category) - categoryRank(b.row.category);
    if (cat !== 0) return cat;
    return String(a.row.plan).localeCompare(String(b.row.plan), "zh-CN");
  });
}

export function statusDisplayClass(row: SubscriptionRow, ref = new Date()): string {
  if (!row.subscribed) return "";
  if (isRowExpired(row, ref)) return "expired";
  if (isCreditLike(row) || !row.dueDate) return "neutral";
  const left = daysUntil(row.dueDate, ref);
  if (left === null) return "neutral";
  if (left < 0) return "urgent";
  if (left <= 3) return "soon";
  return "safe";
}

export function statusTitle(row: SubscriptionRow, ref = new Date()): string {
  if (!row.subscribed) return "未订阅，点击标记为已订阅";
  if (isRowExpired(row, ref)) {
    if (row.expired && !row.dueDate) return "已标记过期，不计入月费";
    const left = daysUntil(row.dueDate, ref);
    if (left !== null && left < 0) return `已过期 ${Math.abs(left)} 天，不计入月费`;
    return "已过期，不计入月费";
  }
  if (!row.dueDate) {
    if (isCreditLike(row)) return "已订阅（额度/赠额，无需续费日）";
    return "已订阅，建议设置续费日";
  }
  const left = daysUntil(row.dueDate, ref);
  if (left === null) return "已订阅";
  if (left < 0) return `已订阅，已过期 ${Math.abs(left)} 天`;
  if (left === 0) return "已订阅，今天续费";
  return `已订阅，距续费 ${left} 天`;
}

export function rowClass(row: SubscriptionRow, ref = new Date()): string {
  const parts: string[] = [];
  if (!row.subscribed) parts.push("row-wishlist");
  else if (isRowExpired(row, ref)) parts.push("row-expired");
  else {
    const left = daysUntil(row.dueDate, ref);
    if (left !== null && left < 0) parts.push("row-overdue");
    if (left !== null && left >= 0 && left <= 3) parts.push("row-soon");
  }
  return parts.join(" ");
}