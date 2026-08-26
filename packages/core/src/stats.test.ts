import { describe, expect, it } from "vitest";
import { spendByCategory, spendByMonth } from "./analytics.js";
import { loadFromJson } from "./load.js";
import { budgetBillsForCalendarMonth, computeSummary } from "./stats.js";
import { sortedBills } from "./views.js";

const REF = new Date("2026-08-15T09:00:00");

describe("预算归属", () => {
  it("旧数据默认计入预算，明确关闭时保留关闭状态", () => {
    const state = loadFromJson({
      budget: 500,
      rows: [
        { id: "legacy", plan: "旧订阅" },
        { id: "off", plan: "账单保留", includeInBudget: false },
      ],
      bills: [],
    });

    expect(state.rows.map((row) => row.includeInBudget)).toEqual([true, false]);
  });

  it("关闭预算归属后账单仍可见，但不会进入预算和统计", () => {
    const state = loadFromJson({
      budget: 500,
      rows: [
        {
          id: "on",
          category: "AI 服务",
          plan: "预算内",
          fee: "20",
          includeInBudget: true,
          subscribed: true,
          dueDate: "2026-09-01",
        },
        {
          id: "off",
          category: "开发工具",
          plan: "仅账单",
          fee: "30",
          includeInBudget: false,
          subscribed: true,
          dueDate: "2026-09-01",
        },
      ],
      bills: [
        { id: "b-on", subscriptionId: "on", amount: 20, paidAt: "2026-08-10" },
        { id: "b-off", subscriptionId: "off", amount: 30, paidAt: "2026-08-11" },
      ],
    });

    expect(sortedBills(state)).toHaveLength(2);
    expect(budgetBillsForCalendarMonth(state, "2026-08").map((bill) => bill.id)).toEqual(["b-on"]);
    expect(computeSummary(state, REF).monthSpend).toBe(20);
    expect(spendByCategory(state, "2026-08", REF).map((row) => row.category)).toEqual(["AI 服务"]);
    expect(spendByMonth(state, 1, REF)[0]).toMatchObject({ total: 20, billCount: 1 });
  });
});
