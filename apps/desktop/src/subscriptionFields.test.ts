import { describe, expect, it } from "vitest";
import {
  OTHER_PROVIDER,
  PROVIDERS,
  annualSaving,
  billingModelNeedsDueDate,
  defaultCategoryForProvider,
  defaultProviderForPlan,
  firstCycleOf,
  formDefaultsFromCategory,
  inferProviderFromPlan,
  isCustomPlanMode,
  parseSeatPlan,
  priceForCycle,
  totalPriceForCycle,
} from "./subscriptionFields";

describe("subscription fields", () => {
  it("maps legacy category values to independent fields", () => {
    expect(formDefaultsFromCategory("中转额度包")).toEqual({
      category: "AI 服务",
      purchaseChannel: "中转",
      billingModel: "额度包",
    });
    expect(formDefaultsFromCategory("中转")).toEqual({
      category: "AI 服务",
      purchaseChannel: "中转",
      billingModel: "月付",
    });
    expect(formDefaultsFromCategory("自定义")).toEqual({
      category: "自定义",
      purchaseChannel: "官方",
      billingModel: "月付",
    });
  });

  it("requires renewal dates only for recurring billing", () => {
    expect(billingModelNeedsDueDate("月付")).toBe(true);
    expect(billingModelNeedsDueDate("季付")).toBe(true);
    expect(billingModelNeedsDueDate("年付")).toBe(true);
    expect(billingModelNeedsDueDate("按量计费")).toBe(false);
    expect(billingModelNeedsDueDate("额度包")).toBe(false);
  });

  it("infers provider from plan name", () => {
    expect(inferProviderFromPlan("ChatGPT Plus")).toBe("openai");
    expect(inferProviderFromPlan("Claude Max 5x")).toBe("claude");
    expect(inferProviderFromPlan("Cursor Pro")).toBe("cursor");
    expect(inferProviderFromPlan("SuperGrok")).toBe("grok");
    expect(inferProviderFromPlan("relayjiekou.com")).toBeNull();
    expect(inferProviderFromPlan("")).toBeNull();
  });

  it("maps built-in providers to default categories", () => {
    expect(defaultCategoryForProvider("OpenAI")).toBe("AI 服务");
    expect(defaultCategoryForProvider("Cursor")).toBe("开发工具");
    expect(defaultCategoryForProvider("Midjourney")).toBe("设计创作");
    expect(defaultCategoryForProvider("Canva")).toBe("其他");
    expect(defaultCategoryForProvider("")).toBe("其他");
  });

  it("defaults to first provider for empty plan, other for unknown", () => {
    expect(defaultProviderForPlan("")).toBe("openai");
    expect(defaultProviderForPlan("Claude Pro")).toBe("claude");
    expect(defaultProviderForPlan("某个中转站")).toBe(OTHER_PROVIDER);
  });

  it("uses custom input only when plan is not a built-in preset", () => {
    expect(isCustomPlanMode("")).toBe(false);
    expect(isCustomPlanMode("ChatGPT Plus")).toBe(false);
    expect(isCustomPlanMode("ChatGPT Team（5人）")).toBe(false);
    expect(isCustomPlanMode("ChatGPT Team")).toBe(false);
    expect(isCustomPlanMode("ChatGPT Enterprise")).toBe(true);
    expect(isCustomPlanMode("relayjiekou.com")).toBe(true);
  });

  it("computes cycle prices with explicit values and monthly derivation", () => {
    const plus = PROVIDERS[0].plans.find((p) => p.name === "ChatGPT Plus")!;
    expect(priceForCycle(plus, "月付")).toBe(20);
    expect(priceForCycle(plus, "年付")).toBe(200); // 显式年付价（折扣）
    expect(priceForCycle(plus, "季付")).toBe(60); // 月付×3 推导
    const go = PROVIDERS[0].plans.find((p) => p.name === "ChatGPT Go")!;
    expect(priceForCycle(go, "年付")).toBe(96); // 月付×12 推导
    expect(firstCycleOf(plus)).toBe("月付");
  });

  it("multiplies seat price for team plans", () => {
    const team = PROVIDERS[0].plans.find((p) => p.name === "ChatGPT Team")!;
    expect(team.perSeat).toBe(true);
    expect(totalPriceForCycle(team, "月付", 5)).toBe(125); // 25×5
    expect(totalPriceForCycle(team, "年付", 2)).toBe(480); // 240×2
    const plus = PROVIDERS[0].plans.find((p) => p.name === "ChatGPT Plus")!;
    expect(totalPriceForCycle(plus, "月付", 5)).toBe(20); // 非团队版不乘人数
  });

  it("parses seat count from plan name", () => {
    expect(parseSeatPlan("ChatGPT Team（5人）")).toEqual({ name: "ChatGPT Team", seats: 5 });
    expect(parseSeatPlan("ChatGPT Plus")).toBeNull();
    expect(parseSeatPlan("")).toBeNull();
  });

  it("provider inference ignores seat suffix", () => {
    expect(defaultProviderForPlan("Claude Team（10人）")).toBe("claude");
    expect(isCustomPlanMode("Claude Team（10人）")).toBe(false);
  });

  it("reports annual discount only when explicit annual price is below monthly×12", () => {
    const plus = PROVIDERS[0].plans.find((p) => p.name === "ChatGPT Plus")!;
    expect(annualSaving(plus)).toEqual({ percentOff: 17 }); // 200 vs 240
    const go = PROVIDERS[0].plans.find((p) => p.name === "ChatGPT Go")!;
    expect(annualSaving(go)).toBeNull(); // 无显式年付价
    expect(annualSaving({ name: "X", prices: { 月付: "20", 年付: "240" } })).toBeNull(); // 无折扣
  });
});
