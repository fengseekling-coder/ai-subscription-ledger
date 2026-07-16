import { normalizeBill, normalizeRow } from "../normalize.js";
import { moneyValue } from "../money.js";
import { normalizeEnglishMonthDate, todayLocalISO } from "../dates.js";
import type { AppState, Bill, SubscriptionRow } from "../types.js";
import type { ConnectorPasteResult } from "./types.js";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? v : [];
}

/** v3 整包或仅 bills */
function parseGenericBillsJson(raw: string): ConnectorPasteResult {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (parsed.budget !== undefined && Array.isArray(parsed.rows)) {
    return {
      rows: parsed.rows as Partial<SubscriptionRow>[],
      bills: asArray(parsed.bills),
      note: "已识别为订阅账本 v3 备份",
    };
  }
  if (Array.isArray(parsed)) {
    return { bills: parsed as Partial<Bill>[], note: "已识别为账单数组" };
  }
  if (Array.isArray(parsed.bills)) {
    return { bills: parsed.bills as Partial<Bill>[], note: "已识别为 bills 字段" };
  }
  throw new Error("无法识别 JSON 结构");
}

/** OpenAI 风格：{ data: [{ amount, date }] } 或 usage 导出 */
function parseOpenAiUsageJson(raw: string): ConnectorPasteResult {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const data = asArray<{ amount?: number; cost?: number; date?: string; timestamp?: string }>(
    parsed.data ?? parsed.usage ?? parsed
  );
  if (!data.length) return parseGenericBillsJson(raw);
  const bills: Partial<Bill>[] = data.map((item) => {
    const amt = Number(item.amount ?? item.cost) || 0;
    const d = String(item.date ?? item.timestamp ?? "").slice(0, 10) || todayLocalISO();
    return normalizeBill({ amount: amt, paidAt: d, orderId: "", note: "OpenAI 用量导入", kind: "payment" });
  });
  return { bills, note: `OpenAI 用量 ${bills.length} 条` };
}

/** 纯文本：订单号、日期、金额（中转站/VM 服务常见） */
function parseRelayOrderText(raw: string): ConnectorPasteResult {
  const bills: Partial<Bill>[] = [];
  const rows: Partial<SubscriptionRow>[] = [];

  // 整段文本匹配（不按行）
  // 订单号：#DMIT-, 訂單, 订单, DMIT-
  const orderM =
    raw.match(/#([A-Za-z0-9-]{5,})/)?.[1] ||
    raw.match(/[訂订]單\s*([A-Za-z0-9-]+)/i)?.[1] ||
    raw.match(/账单\s*#?([A-Za-z0-9-]+)/i)?.[1] ||
    raw.match(/\b(DMIT-\d+)\b/i)?.[1];

  // 日期：YYYY-MM-DD, MM/DD/YYYY, 16 Jul 2026, Jul 16 2026
  const isoDate = raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const slashMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const wordDate = !isoDate && !slashMatch ? normalizeEnglishMonthDate(raw) : null;
  const dateM: string | null =
    isoDate ??
    (slashMatch ? `${slashMatch[3]}-${slashMatch[1]}-${slashMatch[2]}` : null) ??
    wordDate;

  // 金额：$16.90 USD, ¥29.9, 16.90 USD
  const amtM =
    raw.match(/\$\s*(\d+(?:\.\d+)?)/)?.[1] ||
    raw.match(/[¥￥]\s*(\d+(?:\.\d+)?)/)?.[1] ||
    null;

  if (orderM || dateM) {
    let paidAt = todayLocalISO();
    if (dateM) {
      paidAt = dateM;
    }

    const amount = amtM ? moneyValue(amtM) : 0;

    bills.push(
      normalizeBill({
        amount,
        paidAt,
        orderId: orderM ?? "",
        note: raw.slice(0, 200),
        kind: "payment",
      })
    );
    return { bills, note: `解析 1 笔账单` };
  }

  // 无法解析时 fallback
  if (raw.length < 500) {
    rows.push(
      normalizeRow({
        category: "中转",
        plan: "粘贴导入订阅",
        fee: "",
        subscribed: true,
        usage: raw.trim(),
        dueDate: "",
      })
    );
    return { rows, note: "已按备注写入一条订阅" };
  }
  return { bills, note: `解析 ${bills.length} 笔账单/订单` };
}

const parsers: Record<string, (raw: string) => ConnectorPasteResult> = {
  "generic-bills-json": parseGenericBillsJson,
  "openai-usage-json": (raw) => {
    try {
      return parseOpenAiUsageJson(raw);
    } catch {
      return parseGenericBillsJson(raw);
    }
  },
  "relay-order-text": parseRelayOrderText,
};

export function runConnectorPaste(connectorId: string, raw: string): ConnectorPasteResult {
  const fn = parsers[connectorId] ?? parseRelayOrderText;
  return fn(raw.trim());
}

export function mergeConnectorResult(state: AppState, result: ConnectorPasteResult): AppState {
  const rows = [...state.rows];
  const bills = [...state.bills];

  for (const r of result.rows ?? []) {
    const row = normalizeRow(r);
    const dup = rows.some((x) => x.plan === row.plan && x.category === row.category);
    if (!dup) rows.push(row);
  }

  for (const b of result.bills ?? []) {
    let bill = normalizeBill(b);
    if (!bill.subscriptionId && rows.length) {
      bill = { ...bill, subscriptionId: rows[rows.length - 1].id };
    }
    if (bill.subscriptionId) {
      const dup = bills.some(
        (x) =>
          x.subscriptionId === bill.subscriptionId &&
          (bill.orderId ? x.orderId === bill.orderId : x.paidAt === bill.paidAt && x.amount === bill.amount)
      );
      if (!dup) bills.push(bill);
    }
  }

  return { ...state, rows, bills };
}

export function connectorIds(): string[] {
  return Object.keys(parsers);
}