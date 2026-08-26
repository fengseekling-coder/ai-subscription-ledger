import { normalizeBill, normalizeRow } from "./normalize.js";
import { moneyValue } from "./money.js";
import { normalizeEnglishMonthDate, todayLocalISO } from "./dates.js";
import type { Bill, SubscriptionRow } from "./types.js";

export interface ConnectorPasteResult {
  rows?: Partial<SubscriptionRow>[];
  bills?: Partial<Bill>[];
  note?: string;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

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

function parseRelayOrderText(raw: string): ConnectorPasteResult {
  const bills: Partial<Bill>[] = [];
  const rows: Partial<SubscriptionRow>[] = [];

  const orderId =
    raw.match(/#([A-Za-z0-9-]{5,})/)?.[1] ||
    raw.match(/[訂订][單单]\s*([A-Za-z0-9-]+)/i)?.[1] ||
    raw.match(/账单\s*#?([A-Za-z0-9-]+)/i)?.[1] ||
    raw.match(/\b(DMIT-\d+)\b/i)?.[1];

  const isoDate = raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const slashMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const wordDate = !isoDate && !slashMatch ? normalizeEnglishMonthDate(raw) : null;
  const paidAt =
    isoDate ??
    (slashMatch ? `${slashMatch[3]}-${slashMatch[1]}-${slashMatch[2]}` : null) ??
    wordDate;

  const amountMatch =
    raw.match(/\$\s*(\d+(?:\.\d+)?)/)?.[1] ||
    raw.match(/[¥￥]\s*(\d+(?:\.\d+)?)/)?.[1] ||
    null;

  if (orderId || paidAt) {
    const skipPrefixes = [
      "小计",
      "合計",
      "總計",
      "余额",
      "餘額",
      "账户余额",
      "帳戶餘額",
      "金额",
      "金額",
      "状态",
      "狀態",
      "交易",
      "支付",
    ];
    const skipPatterns = [
      /^[─\-=]{3,}$/,
      /^\(\d{2}\/\d{2}\/\d{4}\s*[-–]\s*\d{2}\/\d{2}\/\d{4}\)/,
      /\$\d+(?:\.\d+)?\s*USD/,
      /^[A-Z]{2,}-\d+/,
      /^[A-Z][A-Za-z0-9_]+\.[A-Za-z0-9]+\.[A-Za-z0-9]+\s*[-–]\s*[A-Z]/,
    ];
    const noteLines = raw
      .split("\n")
      .filter((line) => {
        const text = line.trim();
        if (!text) return false;
        if (skipPrefixes.some((prefix) => text.startsWith(prefix))) return false;
        return !skipPatterns.some((pattern) => pattern.test(text));
      });

    bills.push(
      normalizeBill({
        amount: amountMatch ? moneyValue(amountMatch) : 0,
        paidAt: paidAt ?? todayLocalISO(),
        orderId: orderId ?? "",
        note: noteLines.length ? noteLines.join(" · ") : raw.slice(0, 200),
        kind: "payment",
      })
    );
    return { bills, note: "解析 1 笔账单" };
  }

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
  return { bills, note: "解析 0 笔账单/订单" };
}

const parsers: Record<string, (raw: string) => ConnectorPasteResult> = {
  "generic-bills-json": parseGenericBillsJson,
  "relay-order-text": parseRelayOrderText,
};

export function runConnectorPaste(connectorId: string, raw: string): ConnectorPasteResult {
  const parser = parsers[connectorId] ?? parseRelayOrderText;
  return parser(raw.trim());
}
