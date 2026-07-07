import type { Bill, SubscriptionRow } from "./types.js";

function haystack(row: SubscriptionRow): string {
  return [row.category, row.plan, row.fee, row.usage, row.dueDate].join(" ").toLowerCase();
}

function billHaystack(bill: Bill, plan: string): string {
  return [plan, bill.orderId, bill.note, bill.paidAt, String(bill.amount)].join(" ").toLowerCase();
}

/** 订阅行是否匹配搜索（空串 = 全部） */
export function rowMatchesQuery(row: SubscriptionRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack(row).includes(q);
}

export function billMatchesQuery(bill: Bill, plan: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return billHaystack(bill, plan).includes(q);
}

export function filterRowEntries<T extends { row: SubscriptionRow }>(entries: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return entries;
  return entries.filter((e) => rowMatchesQuery(e.row, q));
}