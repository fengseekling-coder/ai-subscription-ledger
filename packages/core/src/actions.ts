import { nextMonthlyDueDate, todayLocalISO } from "./dates.js";
import { moneyValue } from "./money.js";
import { normalizeBill, normalizeRow } from "./normalize.js";
import { isActiveSubscription, needsDueDate } from "./rules.js";
import { normalizeDateInput } from "./dates.js";
import { rowFromCatalogId } from "./catalog/from-catalog.js";
import type { AppState, Bill, SubscriptionRow } from "./types.js";

export function subById(state: AppState, id: string): SubscriptionRow | undefined {
  return state.rows.find((r) => r.id === id);
}

export function addRowFromCatalog(state: AppState, catalogId: string, subscribed = false): AppState | { error: string } {
  const row = rowFromCatalogId(catalogId, subscribed);
  if (!row) return { error: "未找到该服务" };
  return { ...state, rows: [...state.rows, row] };
}

export function addRow(state: AppState): AppState {
  const rows = [
    ...state.rows,
    normalizeRow({
      category: "官方",
      plan: "新套餐",
      fee: "",
      subscribed: false,
      usage: "",
      dueDate: "",
    }),
  ];
  return { ...state, rows };
}

export function addRowWithDetails(
  state: AppState,
  patch: Pick<SubscriptionRow, "category" | "plan" | "fee" | "usage" | "dueDate" | "subscribedAt"> & {
    subscribed: boolean;
    expired: boolean;
  }
): AppState | { error: string } {
  const plan = patch.plan.trim();
  if (!plan) return { error: "请填写套餐名称" };
  let row = normalizeRow({
    category: patch.category,
    plan,
    fee: patch.fee,
    usage: patch.usage,
    dueDate: patch.dueDate,
    subscribedAt: patch.subscribedAt,
    subscribed: patch.subscribed,
    expired: patch.expired,
  });
  if (row.subscribed && !row.subscribedAt) {
    row = { ...row, subscribedAt: todayLocalISO() };
  }
  return { ...state, rows: [...state.rows, row] };
}

export function updateRowField(
  state: AppState,
  index: number,
  key: keyof SubscriptionRow,
  value: string
): AppState | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  const rows = state.rows.slice();
  const row = { ...rows[index], [key]: String(value).trim() } as SubscriptionRow;
  if (key === "category" || key === "plan" || key === "fee") {
    rows[index] = normalizeRow(row);
  } else {
    rows[index] = row;
  }
  if (!rows[index].subscribed) rows[index].dueDate = "";
  return { ...state, rows };
}

export function updateRow(state: AppState, index: number, patch: Partial<SubscriptionRow>): AppState | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  const rows = state.rows.slice();
  rows[index] = normalizeRow({ ...rows[index], ...patch });
  return { ...state, rows };
}

export function toggleSubscribe(state: AppState, index: number, ref = new Date()): AppState | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  void ref;
  const rows = state.rows.slice();
  const row = { ...rows[index] };
  row.subscribed = !row.subscribed;
  if (!row.subscribed) {
    row.dueDate = "";
    row.subscribedAt = "";
  } else if (!row.subscribedAt) {
    row.subscribedAt = todayLocalISO();
  }
  rows[index] = normalizeRow(row);
  return { ...state, rows };
}

/** 订阅后若缺续费日，返回提示文案（与 HTML 一致） */
export function subscribeNoticeAfterToggle(state: AppState, index: number, ref = new Date()): string | null {
  const row = state.rows[index];
  if (!row?.subscribed) return null;
  void ref;
  if (needsDueDate(row) && !row.dueDate) {
    return `已订阅「${row.plan}」。建议设置续费日，便于预算与提醒。`;
  }
  return null;
}

export function pickDueDate(
  state: AppState,
  index: number,
  rawInput: string | null,
  ref = new Date()
): { state: AppState } | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  void ref;
  if (rawInput === null) return { state };
  const iso = normalizeDateInput(rawInput);
  if (iso === null) return { error: "日期格式请使用 YYYY-MM-DD" };
  const result = updateRowField(state, index, "dueDate", iso);
  if ("error" in result) return result;
  return { state: result };
}

export function markExpired(state: AppState, index: number): AppState | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  const rows = state.rows.slice();
  if (!rows[index].subscribed) return state;
  rows[index] = { ...rows[index], expired: true };
  return { ...state, rows };
}

export function clearExpired(state: AppState, index: number): AppState | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  const rows = state.rows.slice();
  rows[index] = { ...rows[index], expired: false };
  return { ...state, rows };
}

export function deleteRow(state: AppState, index: number): AppState | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  const row = state.rows[index];
  const rows = state.rows.filter((_, i) => i !== index);
  const bills = state.bills.filter((b) => b.subscriptionId !== row.id);
  return { ...state, rows, bills };
}

export function markUnrenewed(state: AppState, index: number, choice: "delete" | "unsubscribe"): AppState | { error: string } {
  if (choice === "delete") return deleteRow(state, index);
  const result = updateRow(state, index, { subscribed: false, dueDate: "", subscribedAt: "", expired: false });
  if ("error" in result) return result;
  return result;
}

export function renewRow(state: AppState, index: number, ref = new Date()): AppState | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  const rows = state.rows.slice();
  const prevDue = rows[index].dueDate;
  rows[index] = normalizeRow({
    ...rows[index],
    dueDate: nextMonthlyDueDate(rows[index].dueDate, ref),
    subscribed: true,
    expired: false,
  });
  const bills = [...state.bills];
  const amt = moneyValue(rows[index].fee);
  if (amt > 0) {
    const monthKey = todayLocalISO().slice(0, 7);
    const dup = bills.some(
      (b) =>
        b.subscriptionId === rows[index].id &&
        b.kind === "renewal" &&
        b.paidAt.slice(0, 7) === monthKey
    );
    if (!dup) {
      bills.push(
        normalizeBill({
          subscriptionId: rows[index].id,
          amount: amt,
          paidAt: todayLocalISO(),
          orderId: "",
          note: prevDue ? `续费（原到期 ${prevDue}）· 预付下期` : "续费",
          kind: "renewal",
        })
      );
    }
  }
  return { ...state, rows, bills };
}

export function addBill(state: AppState, ref = new Date()): AppState | { error: string } {
  const active = state.rows.filter((r) => isActiveSubscription(r, ref));
  const pick = active[0] || state.rows[0];
  if (!pick) return { error: "请先添加订阅，再记账单。" };
  const bills = [
    ...state.bills,
    normalizeBill({
      subscriptionId: pick.id,
      amount: moneyValue(pick.fee),
      paidAt: todayLocalISO(),
      orderId: "",
      note: "",
    }),
  ];
  return { ...state, bills };
}

export function updateBill(state: AppState, billId: string, key: keyof Bill, value: string | number): AppState {
  const bills = state.bills.map((b) => {
    if (b.id !== billId) return b;
    if (key === "amount") return { ...b, amount: moneyValue(value) };
    return { ...b, [key]: String(value).trim() };
  });
  return { ...state, bills };
}

export function deleteBill(state: AppState, billId: string): AppState {
  return { ...state, bills: state.bills.filter((b) => b.id !== billId) };
}

export function setBudget(state: AppState, budget: number): AppState {
  const n = Number(budget);
  return { ...state, budget: Number.isFinite(n) && n >= 0 ? n : 500 };
}