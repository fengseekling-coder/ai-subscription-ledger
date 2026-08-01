import { formatDate, nextRecurringDueDate, normalizeDateInput } from "./dates.js";
import { feeToCnyAmount, moneyValue } from "./money.js";
import { normalizeBill, normalizeRow } from "./normalize.js";
import { isActiveSubscription, needsDueDate } from "./rules.js";
import type { AppState, Bill, SubscriptionRow } from "./types.js";

/** 索引边界校验，通过则返回 rows 副本，否则返回错误。 */
function guardIndex(state: AppState, index: number): { rows: SubscriptionRow[] } | { error: string } {
  if (index < 0 || index >= state.rows.length) {
    return { error: "索引超出范围" };
  }
  return { rows: state.rows.slice() };
}

export function subById(state: AppState, id: string): SubscriptionRow | undefined {
  return state.rows.find((r) => r.id === id);
}

export function addRowWithDetails(
  state: AppState,
  patch: Pick<
    SubscriptionRow,
    | "category"
    | "purchaseChannel"
    | "billingModel"
    | "plan"
    | "fee"
    | "usage"
    | "dueDate"
    | "subscribedAt"
  > & {
    subscribed: boolean;
    expired: boolean;
  },
  ref = new Date()
): AppState | { error: string } {
  const plan = patch.plan.trim();
  if (!plan) return { error: "请填写套餐名称" };
  let row = normalizeRow({
    category: patch.category,
    purchaseChannel: patch.purchaseChannel,
    billingModel: patch.billingModel,
    plan,
    fee: patch.fee,
    usage: patch.usage,
    dueDate: patch.dueDate,
    subscribedAt: patch.subscribedAt,
    subscribed: patch.subscribed,
    expired: patch.expired,
  });
  if (row.subscribed && !row.subscribedAt) {
    row = { ...row, subscribedAt: formatDate(ref) };
  }
  return { ...state, rows: [...state.rows, row] };
}

export function updateRowField(
  state: AppState,
  index: number,
  key: keyof SubscriptionRow,
  value: string
): AppState | { error: string } {
  const g = guardIndex(state, index);
  if ("error" in g) return g;
  const raw = String(value).trim();
  const rows = g.rows;
  let row: SubscriptionRow;
  if (key === "subscribed" || key === "expired") {
    // 布尔字段需转回 boolean，避免 UI 的 string 值把字段污染成字符串
    row = { ...rows[index], [key]: raw === "true" || raw === "1" } as SubscriptionRow;
  } else if (key === "category" || key === "plan" || key === "fee") {
    row = normalizeRow({ ...rows[index], [key]: raw });
  } else {
    row = { ...rows[index], [key]: raw };
  }
  if (!row.subscribed) row.dueDate = "";
  rows[index] = row;
  return { ...state, rows };
}

export function updateRow(state: AppState, index: number, patch: Partial<SubscriptionRow>): AppState | { error: string } {
  const g = guardIndex(state, index);
  if ("error" in g) return g;
  const rows = g.rows;
  rows[index] = normalizeRow({ ...rows[index], ...patch });
  return { ...state, rows };
}

export function toggleSubscribe(state: AppState, index: number, ref = new Date()): AppState | { error: string } {
  const g = guardIndex(state, index);
  if ("error" in g) return g;
  const rows = g.rows;
  const row = { ...rows[index] };
  row.subscribed = !row.subscribed;
  if (!row.subscribed) {
    row.dueDate = "";
    row.subscribedAt = "";
  } else if (!row.subscribedAt) {
    row.subscribedAt = formatDate(ref);
  }
  rows[index] = normalizeRow(row);
  return { ...state, rows };
}

/** 订阅后若缺续费日，返回提示文案（与 HTML 一致） */
export function subscribeNoticeAfterToggle(state: AppState, index: number, ref = new Date()): string | null {
  const row = state.rows[index];
  if (!row?.subscribed) return null;
  if (needsDueDate(row, ref) && !row.dueDate) {
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
  const g = guardIndex(state, index);
  if ("error" in g) return g;
  if (rawInput === null) return { state };
  const iso = normalizeDateInput(rawInput, ref);
  if (iso === null) return { error: "日期格式请使用 YYYY-MM-DD" };
  const result = updateRowField(state, index, "dueDate", iso);
  if ("error" in result) return result;
  return { state: result };
}

export function markExpired(state: AppState, index: number): AppState | { error: string } {
  const g = guardIndex(state, index);
  if ("error" in g) return g;
  const rows = g.rows;
  if (!rows[index].subscribed) return state;
  rows[index] = { ...rows[index], expired: true };
  return { ...state, rows };
}

export function clearExpired(state: AppState, index: number): AppState | { error: string } {
  const g = guardIndex(state, index);
  if ("error" in g) return g;
  const rows = g.rows;
  rows[index] = { ...rows[index], expired: false };
  return { ...state, rows };
}

export function deleteRow(state: AppState, index: number): AppState | { error: string } {
  const g = guardIndex(state, index);
  if ("error" in g) return g;
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
  const g = guardIndex(state, index);
  if ("error" in g) return g;
  const rows = g.rows;
  const prevDue = rows[index].dueDate;
  const intervalMonths = rows[index].billingModel === "年付" ? 12 : 1;
  rows[index] = normalizeRow({
    ...rows[index],
    dueDate: nextRecurringDueDate(rows[index].dueDate, intervalMonths, ref),
    subscribed: true,
    expired: false,
  });
  const bills = [...state.bills];
  const amt = feeToCnyAmount(rows[index].fee);
  if (amt > 0) {
    // 去重键与 paidAt 都必须来自同一个 ref。之前 dueDate 用 ref、这里用真实时钟，
    // 传入 ref 时「每月只记一笔续费」会对着错误的月份判重。
    const monthKey = formatDate(ref).slice(0, 7);
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
          paidAt: formatDate(ref),
          orderId: "",
          note: prevDue ? `续费（原到期 ${prevDue}）· 预付下期` : "续费",
          kind: "renewal",
        })
      );
    }
  }
  return { ...state, rows, bills };
}

/** 账单表单的字段。amount 保持字符串，由 moneyValue 解析用户输入。 */
export interface BillDraft {
  subscriptionId: string;
  amount: string;
  paidAt: string;
  orderId: string;
  note: string;
}

/**
 * 「记账单」的预填：默认选中第一个在用订阅，金额按其月费折算为 ¥。
 * 只负责给出草稿，实际入账由 addBillWithDetails 完成——用户可以先改再存。
 */
export function billDraftFor(state: AppState, ref = new Date()): BillDraft | { error: string } {
  const active = state.rows.filter((r) => isActiveSubscription(r, ref));
  const pick = active[0] || state.rows[0];
  if (!pick) return { error: "请先添加订阅，再记账单。" };
  const amount = feeToCnyAmount(pick.fee);
  return {
    subscriptionId: pick.id,
    amount: amount > 0 ? String(amount) : "",
    paidAt: formatDate(ref),
    orderId: "",
    note: "",
  };
}

/** 草稿 → 合法字段，供新增与编辑共用。 */
function validateBillDraft(
  state: AppState,
  draft: BillDraft,
  ref: Date
): { subscriptionId: string; amount: number; paidAt: string; orderId: string; note: string } | { error: string } {
  const subscriptionId = draft.subscriptionId.trim();
  if (!subscriptionId || !subById(state, subscriptionId)) {
    return { error: "请选择关联订阅" };
  }
  const amount = moneyValue(draft.amount);
  if (!(amount > 0)) return { error: "请填写有效金额" };
  const paidAt = normalizeDateInput(draft.paidAt, ref);
  if (paidAt === null) return { error: "日期格式请使用 YYYY-MM-DD" };
  return {
    subscriptionId,
    amount,
    paidAt: paidAt || formatDate(ref),
    orderId: draft.orderId,
    note: draft.note,
  };
}

export function addBillWithDetails(
  state: AppState,
  draft: BillDraft,
  ref = new Date()
): AppState | { error: string } {
  const fields = validateBillDraft(state, draft, ref);
  if ("error" in fields) return fields;
  return {
    ...state,
    bills: [...state.bills, normalizeBill({ ...fields, kind: "payment" })],
  };
}

/** 整表单更新一笔账单。kind 不由表单改动，沿用原值。 */
export function updateBillDetails(
  state: AppState,
  billId: string,
  draft: BillDraft,
  ref = new Date()
): AppState | { error: string } {
  const existing = state.bills.find((b) => b.id === billId);
  if (!existing) return { error: "未找到该账单" };
  const fields = validateBillDraft(state, draft, ref);
  if ("error" in fields) return fields;
  const bills = state.bills.map((b) =>
    b.id === billId ? normalizeBill({ ...fields, id: b.id, kind: b.kind }) : b
  );
  return { ...state, bills };
}

/** 已有账单 → 表单草稿 */
export function billToDraft(bill: Bill): BillDraft {
  return {
    subscriptionId: bill.subscriptionId,
    amount: String(bill.amount),
    paidAt: bill.paidAt,
    orderId: bill.orderId,
    note: bill.note,
  };
}

export function deleteBill(state: AppState, billId: string): AppState {
  return { ...state, bills: state.bills.filter((b) => b.id !== billId) };
}

export function setBudget(state: AppState, budget: number): AppState {
  const n = Number(budget);
  return { ...state, budget: Number.isFinite(n) && n >= 0 ? n : 500 };
}
