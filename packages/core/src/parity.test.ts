import { describe, expect, it } from "vitest";
import { createDemoState } from "./load.js";
import { computeSummary, pendingRenewItems } from "./stats.js";
import { fmtMoney } from "./money.js";

/** 固定参考日，与 scripts/parity-html-core.mjs 一致，便于检查统计口径 */
const REF = new Date("2026-07-05T12:00:00");

describe("parity snapshot (ref 2026-07-05)", () => {
  it("default state summary matches expected month spend from bills", () => {
    const state = createDemoState();
    const summary = computeSummary(state, REF);
    expect(summary.monthSpend).toBe(20);
    expect(fmtMoney(summary.monthSpend)).toBe("¥20");
    expect(summary.budget).toBe(500);
    expect(summary.budgetLeft).toBe(480);
    expect(summary.nearestPlan).toBeTruthy();
    expect(state.rows.length).toBeGreaterThanOrEqual(3);
    expect(state.bills.length).toBeGreaterThanOrEqual(1);
  });

  it("pending renew excludes credit-like and uses 0-3 day window", () => {
    const state = createDemoState();
    const pending = pendingRenewItems(state.rows, REF);
    for (const p of pending) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left).toBeLessThanOrEqual(3);
    }
  });
});
