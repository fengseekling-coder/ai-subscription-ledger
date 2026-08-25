import { defaultRowsSeed } from "./defaults.js";
import { normalizeBill, normalizeRow } from "./normalize.js";
import { feeToCnyAmount } from "./money.js";
import { effectiveFee } from "./rules.js";
import type { AppState, Bill, Monitor, SubscriptionRow } from "./types.js";

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
  const amt = feeToCnyAmount(effectiveFee(row));
  if (!(amt > 0) || !paidAt) return null;
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

function normalizeMonitor(value: unknown): Monitor | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = String(raw.id ?? "").trim();
  const serviceId = String(raw.serviceId ?? "").trim();
  const apiKey = String(raw.apiKey ?? "").trim();
  if (!id || !serviceId || !apiKey) return null;

  const status =
    raw.status === "active" ||
    raw.status === "expired" ||
    raw.status === "unknown" ||
    raw.status === "error"
      ? raw.status
      : "unknown";
  const remoteAmount = Number(raw.remoteAmount);

  return {
    id,
    type: raw.type === "browser" ? "browser" : "api",
    apiKey,
    serviceId,
    lastChecked: String(raw.lastChecked ?? ""),
    status,
    statusDetail: String(raw.statusDetail ?? ""),
    remotePlan: String(raw.remotePlan ?? ""),
    remoteAmount: Number.isFinite(remoteAmount) ? remoteAmount : 0,
    remoteRenewalDate: String(raw.remoteRenewalDate ?? ""),
    errorMessage: String(raw.errorMessage ?? ""),
  };
}

type ImportedLedger = {
  budget?: unknown;
  rows?: unknown[];
  bills?: unknown[];
};

function hydrateLedger(parsed: ImportedLedger): Pick<AppState, "budget" | "rows" | "bills"> {
  const rows = (Array.isArray(parsed.rows) ? parsed.rows : []).map((r) =>
    normalizeRow(r as Partial<SubscriptionRow> & Record<string, unknown>)
  );
  const bills = ensureBillsFromRows(
    rows,
    Array.isArray(parsed.bills) ? parsed.bills.map((b) => normalizeBill(b as Partial<Bill>)) : []
  );
  ensureSubscribedAtFromRows(rows, bills);
  const rawBudget = Number(parsed.budget);
  return {
    budget: Number.isFinite(rawBudget) && rawBudget >= 0 ? rawBudget : 500,
    rows,
    bills,
  };
}

function hydrateImportedState(parsed: ImportedLedger & {
  monitors?: unknown[];
}): AppState {
  const overview = hydrateLedger(parsed);
  const language: AppState["language"] = (() => {
    const raw = (parsed as { language?: unknown }).language;
    return raw === "zh-CN" || raw === "en" || raw === "auto" ? raw : "auto";
  })();
  const monitors = Array.isArray(parsed.monitors)
    ? parsed.monitors
        .map(normalizeMonitor)
        .filter((monitor): monitor is Monitor => monitor !== null)
    : [];
  return {
    ...overview,
    monitors,
    language,
  };
}

// ── public API ───────────────────────────────────────────────────────────────

/** 全新用户：空账本 */
export function createEmptyState(): AppState {
  return { budget: 500, rows: [], bills: [], monitors: [] };
}

/** 开发/单测/parity：带示例订阅（不会自动写入用户数据库） */
export function createDemoState(): AppState {
  const rows = defaultRowsSeed.map((r) => normalizeRow(r));
  const bills = ensureBillsFromRows(rows, []);
  ensureSubscribedAtFromRows(rows, bills);
  return { budget: 500, rows, bills, monitors: [] };
}

export function loadFromJson(parsed: unknown): AppState {
  if (!parsed || typeof parsed !== "object") return createEmptyState();
  const p = parsed as { rows?: unknown[] };
  if (!Array.isArray(p.rows)) return createEmptyState();
  return hydrateImportedState(
    parsed as {
      budget?: unknown;
      rows?: unknown[];
      bills?: unknown[];
      monitors?: unknown[];
      language?: unknown;
      appearance?: unknown;
    }
  );
}
