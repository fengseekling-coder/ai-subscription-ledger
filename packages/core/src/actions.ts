import { formatDate, nextRecurringDueDate, normalizeDateInput } from "./dates.js";
import { feeToCnyAmount, looksLikeUsdFee, moneyValue } from "./money.js";
import { normalizeBill, normalizeRow } from "./normalize.js";
import { billingIntervalMonths, effectiveFee, isActiveSubscription, needsDueDate } from "./rules.js";
import type { AppState, Bill, BillCurrency, SubscriptionRow } from "./types.js";

/** 某笔美元账单在入账当日取得的汇率快照。 */
export interface UsdCnyRateSnapshot {
  rate: number;
  rateDate: string;
  source?: string;
}

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
    | "provider"
    | "billingModel"
    | "plan"
    | "fee"
    | "actualFee"
    | "usage"
    | "dueDate"
    | "subscribedAt"
  > & {
    includeInBudget?: boolean;
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
    provider: patch.provider,
    billingModel: patch.billingModel,
    plan,
    fee: patch.fee,
    actualFee: patch.actualFee,
    includeInBudget: patch.includeInBudget,
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
  if (key === "subscribed" || key === "expired" || key === "includeInBudget") {
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

export function renewRow(
  state: AppState,
  index: number,
  ref = new Date(),
  usdCnyRate?: UsdCnyRateSnapshot
): AppState | { error: string } {
  const g = guardIndex(state, index);
  if ("error" in g) return g;
  const rows = g.rows;
  const prevDue = rows[index].dueDate;
  const intervalMonths = billingIntervalMonths(rows[index].billingModel);
  rows[index] = normalizeRow({
    ...rows[index],
    dueDate: nextRecurringDueDate(rows[index].dueDate, intervalMonths, ref),
    subscribed: true,
    expired: false,
  });
  const bills = [...state.bills];
  const charge = effectiveFee(rows[index]);
  const isUsd = looksLikeUsdFee(charge);
  const amt = feeToCnyAmount(charge, usdCnyRate?.rate);
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
          ...(isUsd
            ? {
                originalAmount: moneyValue(charge),
                originalCurrency: "USD" as BillCurrency,
                exchangeRate: usdCnyRate?.rate,
                exchangeRateDate: usdCnyRate?.rateDate,
                exchangeRateSource: usdCnyRate?.source,
              }
            : { originalAmount: moneyValue(charge), originalCurrency: "CNY" as BillCurrency }),
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
  originalAmount?: number;
  originalCurrency?: BillCurrency;
  exchangeRate?: number;
  exchangeRateDate?: string;
  exchangeRateSource?: string;
}

/**
 * 「记账单」的预填：默认选中第一个在用订阅，金额按其月费折算为 ¥。
 * 只负责给出草稿，实际入账由 addBillWithDetails 完成——用户可以先改再存。
 */
export function billDraftFor(state: AppState, ref = new Date()): BillDraft | { error: string } {
  const active = state.rows.filter((r) => isActiveSubscription(r, ref));
  const pick = active[0] || state.rows[0];
  if (!pick) return { error: "请先添加订阅，再记账单。" };
  const amount = feeToCnyAmount(effectiveFee(pick));
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
): Omit<Bill, "id" | "kind"> | { error: string } {
  const subscriptionId = draft.subscriptionId.trim();
  if (!subscriptionId || !subById(state, subscriptionId)) {
    return { error: "请选择关联订阅" };
  }
  const amount = moneyValue(draft.amount);
  if (!(amount > 0)) return { error: "请填写有效金额" };
  const paidAt = normalizeDateInput(draft.paidAt, ref);
  if (paidAt === null) return { error: "日期格式请使用 YYYY-MM-DD" };
  const originalCurrency =
    draft.originalCurrency === "USD" || draft.originalCurrency === "CNY"
      ? draft.originalCurrency
      : undefined;
  const originalAmount = Number(draft.originalAmount);
  const exchangeRate = Number(draft.exchangeRate);
  return {
    subscriptionId,
    amount,
    paidAt: paidAt || formatDate(ref),
    orderId: draft.orderId,
    note: draft.note,
    ...(originalCurrency && Number.isFinite(originalAmount) && originalAmount >= 0
      ? { originalCurrency, originalAmount }
      : {}),
    ...(originalCurrency === "USD" && Number.isFinite(exchangeRate) && exchangeRate > 0
      ? {
          exchangeRate,
          exchangeRateDate: String(draft.exchangeRateDate || "").slice(0, 10),
          exchangeRateSource: String(draft.exchangeRateSource || "").trim(),
        }
      : {}),
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

/**
 * 添加订阅的首笔付款，并写下防重标记。
 *
 * 该标记即使账单后来被用户删掉也会保留，避免应用重启后又自动补回已删除的账单。
 */
export function addInitialBillWithDetails(
  state: AppState,
  draft: BillDraft,
  ref = new Date()
): AppState | { error: string } {
  const billed = addBillWithDetails(state, draft, ref);
  if ("error" in billed) return billed;
  return {
    ...billed,
    rows: billed.rows.map((row) =>
      row.id === draft.subscriptionId ? { ...row, initialBillRecorded: true } : row
    ),
  };
}

/** 为没有首笔账单的旧订阅写下处理标记，不创建或删除账单。 */
export function markInitialBillsRecorded(state: AppState, subscriptionIds: string[]): AppState {
  if (subscriptionIds.length === 0) return state;
  const ids = new Set(subscriptionIds);
  return {
    ...state,
    rows: state.rows.map((row) =>
      ids.has(row.id) && !row.initialBillRecorded ? { ...row, initialBillRecorded: true } : row
    ),
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
    originalAmount: bill.originalAmount,
    originalCurrency: bill.originalCurrency,
    exchangeRate: bill.exchangeRate,
    exchangeRateDate: bill.exchangeRateDate,
    exchangeRateSource: bill.exchangeRateSource,
  };
}

export function deleteBill(state: AppState, billId: string): AppState {
  return { ...state, bills: state.bills.filter((b) => b.id !== billId) };
}

export function setBudget(state: AppState, budget: number): AppState {
  const n = Number(budget);
  return { ...state, budget: Number.isFinite(n) && n >= 0 ? n : 500 };
}
