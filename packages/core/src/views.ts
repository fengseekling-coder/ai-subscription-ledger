import { isRowExpired, sortRowEntries } from "./rules.js";
import type { AppState, SubscriptionRow } from "./types.js";

export function visibleRowEntries(state: AppState, ref = new Date()) {
  return sortRowEntries(
    state.rows.map((row, index) => ({ row, index })).filter(({ row }) => !isRowExpired(row, ref)),
    ref
  );
}

export function expiredRowEntries(state: AppState, ref = new Date()) {
  return sortRowEntries(
    state.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.subscribed && isRowExpired(row, ref)),
    ref
  );
}

export function rowIndexById(state: AppState, id: string): number {
  return state.rows.findIndex((r) => r.id === id);
}

export function sortedBills(state: AppState) {
  return (state.bills || []).slice().sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));
}

export type RowEntry = { row: SubscriptionRow; index: number };