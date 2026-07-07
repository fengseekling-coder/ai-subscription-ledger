import { defaultRowsSeed } from "./defaults.js";
import { normalizeBill, normalizeRow } from "./normalize.js";
import { moneyValue } from "./money.js";
import type { AppState, Bill, SubscriptionRow } from "./types.js";

// ── migrated helpers (inlined from old migrate.ts) ───────────────────────────

/** 仅修正已有行（改名、过期标记），不向账本注入新订阅 */
function applyRowMigrations(rows: SubscriptionRow[]): boolean {
  void rows;
  return false;
}

function parseUsagePaymentDate(row: SubscriptionRow): string {
  const u = String(row.usage || "").trim();
  if (!u) return "";
  const m2 = u.match(/(\d{4}-\d{2}-\d{2})/);
  return m2 ? m2[1] : "";
}

function parseUsageToBill(row: SubscriptionRow): Bill | null {
  const u = String(row.usage || "").trim();
  if (!u || u.includes("累计") || u.includes("按时间")) return null;
  let orderId = "";
  let paidAt = "";
  let note = u;
  const m1 = u.match(/订单\s*([A-Za-z0-9]+)/);
  if (m1) orderId = m1[1];
  const m2 = u.match(/(\d{4}-\d{2}-\d{2})/);
  if (m2) paidAt = m2[1];
  if (/^[A-Z0-9]{4,}(-[A-Z0-9]+)*$/i.test(u)) {
    orderId = u;
    note = "激活码/订单";
  }
  if (!orderId && !paidAt) return null;
  const amt = moneyValue(row.fee);
  if (!paidAt) return null;
  return normalizeBill({
    subscriptionId: row.id,
    amount: amt,
    paidAt,
    orderId,
    note: note.replace(/订单\s*[A-Za-z0-9-]+/g, "").replace(/\s*·\s*\d{4}-\d{2}-\d{2}/, "").trim(),
  });
}

function ensureSubscribedAtFromRows(rows: SubscriptionRow[], bills: Bill[]): boolean {
  let migrated = false;
  const allBills = bills || [];
  rows.forEach((row) => {
    if (!row.subscribed) return;
    if (row.subscribedAt) return;
    const fromUsage = parseUsagePaymentDate(row);
    if (fromUsage) {
      row.subscribedAt = fromUsage;
      migrated = true;
      return;
    }
    const mine = allBills.filter((b) => b.subscriptionId === row.id);
    const earliest = mine
      .map((b) => b.paidAt)
      .filter(Boolean)
      .sort()[0];
    if (earliest) {
      row.subscribedAt = earliest.slice(0, 10);
      migrated = true;
    }
  });
  return migrated;
}

function ensureBillsFromRows(rows: SubscriptionRow[], bills: Bill[]): Bill[] {
  const out = (bills || []).map(normalizeBill);
  rows.forEach((row) => {
    const draft = parseUsageToBill(row);
    if (!draft) return;
    const dup = out.some(
      (b) =>
        b.subscriptionId === row.id &&
        (draft.orderId ? b.orderId === draft.orderId : b.paidAt === draft.paidAt)
    );
    if (!dup) out.push(draft);
  });
  return out.sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));
}

function hydrateImportedState(parsed: {
  budget?: unknown;
  rows?: unknown[];
  bills?: unknown[];
}): AppState {
  const rows = (Array.isArray(parsed.rows) ? parsed.rows : []).map((r) =>
    normalizeRow(r as Partial<SubscriptionRow> & Record<string, unknown>)
  );
  applyRowMigrations(rows);
  const bills = ensureBillsFromRows(
    rows,
    Array.isArray(parsed.bills) ? parsed.bills.map((b) => normalizeBill(b as Partial<Bill>)) : []
  );
  ensureSubscribedAtFromRows(rows, bills);
  return {
    budget: Number(parsed.budget) || 500,
    rows,
    bills,
  };
}

// ── public API ───────────────────────────────────────────────────────────────

/** 全新用户：空账本 */
export function createEmptyState(): AppState {
  return { budget: 500, rows: [], bills: [] };
}

/** 开发/单测/parity：带示例订阅（不会自动写入用户数据库） */
export function createDemoState(): AppState {
  const rows = defaultRowsSeed.map((r) => normalizeRow(r));
  applyRowMigrations(rows);
  const bills = ensureBillsFromRows(rows, []);
  ensureSubscribedAtFromRows(rows, bills);
  return { budget: 500, rows, bills };
}

/** @deprecated 使用 createDemoState（单测）或 createEmptyState（产品） */
export function createDefaultState(): AppState {
  return createDemoState();
}

export function loadFromJson(parsed: unknown): AppState {
  if (!parsed || typeof parsed !== "object") return createEmptyState();
  const p = parsed as { rows?: unknown[] };
  if (!Array.isArray(p.rows)) return createEmptyState();
  return hydrateImportedState(parsed as { budget?: unknown; rows?: unknown[]; bills?: unknown[] });
}
