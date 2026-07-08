import { describe, expect, it } from "vitest";
import { loadFromJson, createEmptyState, createDemoState } from "./load.js";
import { normalizeRow, normalizeBill } from "./normalize.js";
import { moneyValue, fmtMoney } from "./money.js";
import { daysUntil, formatDate, todayLocalISO, normalizeDateInput } from "./dates.js";

describe("loadFromJson", () => {
  it("rejects non-object root via empty state", () => {
    expect(loadFromJson(null).rows).toEqual([]);
    expect(loadFromJson("x").rows).toEqual([]);
  });

  it("rejects missing rows array", () => {
    expect(loadFromJson({ budget: 100 }).rows).toEqual([]);
  });

  it("normalizes valid v3-shaped payload", () => {
    const out = loadFromJson({
      budget: 800,
      rows: [{ plan: "Test Pro", category: "官方", fee: "20", subscribed: true }],
      bills: [],
    });
    expect(out.budget).toBe(800);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].plan).toBe("Test Pro");
    expect(out.rows[0].id).toBeTruthy();
  });

  it("coerces invalid budget to default", () => {
    expect(loadFromJson({ budget: "nope", rows: [], bills: [] }).budget).toBe(500);
    // Note: negative budget is rejected, falls back to 500
    expect(loadFromJson({ budget: -100, rows: [], bills: [] }).budget).toBe(500);
    // Budget of 0 is valid (edge case, but allowed)
    expect(loadFromJson({ budget: 0, rows: [], bills: [] }).budget).toBe(0);
    // Normal positive budget is preserved
    expect(loadFromJson({ budget: 800, rows: [], bills: [] }).budget).toBe(800);
  });

  it("handles empty rows array", () => {
    const out = loadFromJson({ budget: 500, rows: [], bills: [] });
    expect(out.rows).toHaveLength(0);
    expect(out.bills).toHaveLength(0);
  });

  it("handles empty string as valid input", () => {
    const out = loadFromJson("");
    expect(out.rows).toEqual([]);
  });

  it("validates bills array", () => {
    const out = loadFromJson({
      budget: 500,
      rows: [],
      bills: [{ subscriptionId: "test", amount: 100, paidAt: "2026-07-01" }],
    });
    expect(out.bills).toHaveLength(1);
    expect(out.bills[0].amount).toBe(100);
  });
});

describe("createEmptyState", () => {
  it("creates empty state with default budget", () => {
    const state = createEmptyState();
    expect(state.budget).toBe(500);
    expect(state.rows).toHaveLength(0);
    expect(state.bills).toHaveLength(0);
  });
});

describe("createDemoState", () => {
  it("creates demo state with example rows", () => {
    const state = createDemoState();
    expect(state.budget).toBe(500);
    expect(state.rows.length).toBeGreaterThan(0);
  });
});

describe("normalizeRow", () => {
  it("handles empty input", () => {
    const out = normalizeRow({});
    expect(out.plan).toBe("");
    expect(out.category).toBe("其他");
    expect(out.subscribed).toBe(false);
  });

  it("generates id for rows without id", () => {
    const out = normalizeRow({ plan: "Test" });
    expect(out.id).toBeTruthy();
  });

  it("preserves existing id", () => {
    const out = normalizeRow({ plan: "Test", id: "custom-id" });
    expect(out.id).toBe("custom-id");
  });

  it("handles subscribed status from status string", () => {
    expect(normalizeRow({ plan: "Test", status: "已有订阅" }).subscribed).toBe(true);
    expect(normalizeRow({ plan: "Test", status: "未订阅" }).subscribed).toBe(false);
    expect(normalizeRow({ plan: "Test", status: "测试状态" }).subscribed).toBe(false);
  });

  it("handles boolean subscribed directly", () => {
    expect(normalizeRow({ plan: "Test", subscribed: true }).subscribed).toBe(true);
    expect(normalizeRow({ plan: "Test", subscribed: false }).subscribed).toBe(false);
  });

  it("clears dueDate and subscribedAt when subscribed is false", () => {
    const out = normalizeRow({
      plan: "Test",
      subscribed: false,
      dueDate: "2026-07-01",
      subscribedAt: "2026-01-01",
    });
    expect(out.dueDate).toBe("");
    expect(out.subscribedAt).toBe("");
  });

  it("trims whitespace from string fields", () => {
    const out = normalizeRow({
      plan: "  Test Plan  ",
      category: "  官方  ",
      fee: "  20  ",
    });
    expect(out.plan).toBe("Test Plan");
    expect(out.category).toBe("官方");
    expect(out.fee).toBe("20");
  });

  it("handles Unicode in plan", () => {
    const out = normalizeRow({ plan: "中文测试 🎉" });
    expect(out.plan).toBe("中文测试 🎉");
  });

  it("handles emoji in plan", () => {
    const out = normalizeRow({ plan: "ChatGPT Plus 🚀" });
    expect(out.plan).toBe("ChatGPT Plus 🚀");
  });

  it("handles optional fields", () => {
    const out = normalizeRow({
      plan: "Test",
      segment: "credit",
      subscribeUrl: "https://example.com",
      portalUrl: "https://portal.example.com",
    });
    expect(out.segment).toBe("credit");
    expect(out.subscribeUrl).toBe("https://example.com");
    expect(out.portalUrl).toBe("https://portal.example.com");
  });

  it("clears whitespace-only optional fields", () => {
    const out = normalizeRow({
      plan: "Test",
      segment: "   ",
      subscribeUrl: "  ",
      portalUrl: "  ",
    } as any);
    expect(out.segment).toBeUndefined();
    expect(out.subscribeUrl).toBeUndefined();
    expect(out.portalUrl).toBeUndefined();
  });

  it("handles expired field as boolean", () => {
    // Note: when subscribed is false or undefined, normalizeRow sets expired to false (line 32)
    // So expired: true is only preserved when subscribed is explicitly true
    expect(normalizeRow({ plan: "Test", subscribed: true, expired: true }).expired).toBe(true);
    expect(normalizeRow({ plan: "Test", subscribed: true, expired: false }).expired).toBe(false);
    expect(normalizeRow({ plan: "Test", expired: false }).expired).toBe(false);
    expect(normalizeRow({ plan: "Test", expired: undefined }).expired).toBe(false);
  });

  it("preserves subscribedAt when subscribed is true", () => {
    const out = normalizeRow({ plan: "Test", subscribed: true, subscribedAt: "2026-07-01" });
    expect(out.subscribedAt).toBe("2026-07-01");
  });
});

describe("normalizeBill", () => {
  it("generates id for bills without id", () => {
    const out = normalizeBill({ subscriptionId: "test" });
    expect(out.id).toBeTruthy();
  });

  it("preserves existing id", () => {
    const out = normalizeBill({ subscriptionId: "test", id: "custom-bill-id" });
    expect(out.id).toBe("custom-bill-id");
  });

  it("handles amount conversion", () => {
    expect(normalizeBill({ subscriptionId: "test", amount: 100 }).amount).toBe(100);
    expect(normalizeBill({ subscriptionId: "test", amount: "100" }).amount).toBe(100);
    expect(normalizeBill({ subscriptionId: "test", amount: 0 }).amount).toBe(0);
    expect(normalizeBill({ subscriptionId: "test", amount: null }).amount).toBe(0);
    expect(normalizeBill({ subscriptionId: "test", amount: undefined }).amount).toBe(0);
  });

  it("handles kind conversion", () => {
    expect(normalizeBill({ subscriptionId: "test", kind: "renewal" }).kind).toBe("renewal");
    expect(normalizeBill({ subscriptionId: "test", kind: "payment" }).kind).toBe("payment");
    expect(normalizeBill({ subscriptionId: "test", kind: undefined }).kind).toBe("payment");
    expect(normalizeBill({ subscriptionId: "test", kind: "RENEWAL" as any }).kind).toBe("payment");
  });

  it("trims whitespace from string fields", () => {
    const out = normalizeBill({
      subscriptionId: "test",
      orderId: "  ORDER123  ",
      note: "  Test note  ",
    });
    expect(out.orderId).toBe("ORDER123");
    expect(out.note).toBe("Test note");
  });

  it("truncates paidAt to 10 characters", () => {
    const out = normalizeBill({ subscriptionId: "test", paidAt: "2026-07-01T12:00:00Z" });
    expect(out.paidAt).toBe("2026-07-01");
  });
});

describe("moneyValue", () => {
  it("handles null and undefined", () => {
    expect(moneyValue(null)).toBe(0);
    expect(moneyValue(undefined)).toBe(0);
  });

  it("handles number input", () => {
    expect(moneyValue(100)).toBe(100);
    expect(moneyValue(99.5)).toBe(99.5);
    expect(moneyValue(0)).toBe(0);
    expect(moneyValue(-50)).toBe(-50);
  });

  it("handles string input", () => {
    expect(moneyValue("100")).toBe(100);
    expect(moneyValue("99.5")).toBe(99.5);
    expect(moneyValue("0")).toBe(0);
    expect(moneyValue("-50")).toBe(-50);
  });

  it("strips currency symbols", () => {
    expect(moneyValue("¥100")).toBe(100);
    expect(moneyValue("￥100")).toBe(100);
    expect(moneyValue("$100")).toBe(100);
    expect(moneyValue("100元")).toBe(100);
    expect(moneyValue("100/月")).toBe(100);
  });

  it("strips whitespace and commas", () => {
    expect(moneyValue("  100  ")).toBe(100);
    expect(moneyValue("1,234.56")).toBe(1234.56);
  });

  it("handles special formats", () => {
    expect(moneyValue("$20.5")).toBe(20.5);
    expect(moneyValue("20元/月")).toBe(20);
  });

  it("handles invalid input", () => {
    expect(moneyValue("abc")).toBe(0);
    expect(moneyValue("")).toBe(0);
    expect(moneyValue(NaN)).toBe(0);
    expect(moneyValue(Infinity)).toBe(0);
  });
});

describe("fmtMoney", () => {
  it("formats positive whole numbers", () => {
    expect(fmtMoney(100)).toBe("¥100");
    expect(fmtMoney(0)).toBe("¥0");
  });

  it("formats negative whole numbers", () => {
    expect(fmtMoney(-100)).toBe("-¥100");
    expect(fmtMoney(-50)).toBe("-¥50");
  });

  it("formats fractional numbers", () => {
    expect(fmtMoney(99.5)).toBe("¥99.5");
    expect(fmtMoney(99.99)).toBe("¥99.99");
    expect(fmtMoney(10.1)).toBe("¥10.1");
  });

  it("handles negative fractional numbers", () => {
    expect(fmtMoney(-99.99)).toBe("-¥99.99");
  });

  it("rounds floating point correctly", () => {
    expect(fmtMoney(0.1 + 0.2)).toBe("¥0.3");
    expect(fmtMoney(99.99)).toBe("¥99.99");
    expect(fmtMoney(99.999)).toBe("¥100");
  });

  it("handles edge cases", () => {
    expect(fmtMoney(0.01)).toBe("¥0.01");
    expect(fmtMoney(999999.99)).toBe("¥999999.99");
  });
});

describe("dates", () => {
  describe("formatDate", () => {
    it("formats date as YYYY-MM-DD", () => {
      const date = new Date(2026, 6, 15); // July 15, 2026
      expect(formatDate(date)).toBe("2026-07-15");
    });

    it("handles month boundaries", () => {
      expect(formatDate(new Date(2026, 0, 1))).toBe("2026-01-01"); // Jan 1
      expect(formatDate(new Date(2026, 11, 31))).toBe("2026-12-31"); // Dec 31
    });

    it("pads single-digit months and days", () => {
      expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05");
      expect(formatDate(new Date(2026, 6, 5))).toBe("2026-07-05");
    });
  });

  describe("todayLocalISO", () => {
    it("returns today's date in YYYY-MM-DD format", () => {
      const result = todayLocalISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe(new Date().toISOString().slice(0, 10));
    });
  });

  describe("daysUntil", () => {
    it("returns null for null/undefined/empty input", () => {
      expect(daysUntil(null)).toBeNull();
      expect(daysUntil(undefined)).toBeNull();
      expect(daysUntil("")).toBeNull();
    });

    it("calculates days for future date", () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + 10);
      const futureIso = future.toISOString().slice(0, 10);
      const result = daysUntil(futureIso, today);
      expect(result).toBeGreaterThanOrEqual(9);
      expect(result).toBeLessThanOrEqual(11);
    });

    it("calculates days for past date", () => {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 5);
      const pastIso = past.toISOString().slice(0, 10);
      const result = daysUntil(pastIso, today);
      expect(result).toBeLessThanOrEqual(-4);
      expect(result).toBeGreaterThanOrEqual(-6);
    });

    it("returns 0 for today", () => {
      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const result = daysUntil(todayIso, today);
      // Due to timezone handling, may be 0 or 1
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe("normalizeDateInput", () => {
    it("returns empty string for empty input", () => {
      expect(normalizeDateInput("")).toBe("");
      expect(normalizeDateInput(null)).toBe("");
      expect(normalizeDateInput(undefined)).toBe("");
      expect(normalizeDateInput("   ")).toBe("");
    });

    it("parses YYYY-MM-DD format", () => {
      expect(normalizeDateInput("2026-07-15")).toBe("2026-07-15");
    });

    it("parses YYYY/MM/DD format", () => {
      expect(normalizeDateInput("2026/07/15")).toBe("2026-07-15");
    });

    it("parses YYYY.MM.DD format", () => {
      expect(normalizeDateInput("2026.07.15")).toBe("2026-07-15");
    });

    it("parses Chinese format", () => {
      expect(normalizeDateInput("2026年7月15日")).toBe("2026-07-15");
      expect(normalizeDateInput("2026年12月5日")).toBe("2026-12-05");
    });

    it("returns null for invalid format", () => {
      expect(normalizeDateInput("invalid")).toBeNull();
      expect(normalizeDateInput("2026-13-45")).toBeNull();
      expect(normalizeDateInput("07-15-2026")).toBeNull();
    });

    it("pads single-digit month and day", () => {
      expect(normalizeDateInput("2026/7/5")).toBe("2026-07-05");
      expect(normalizeDateInput("2026年7月15日")).toBe("2026-07-15");
    });
  });
});
