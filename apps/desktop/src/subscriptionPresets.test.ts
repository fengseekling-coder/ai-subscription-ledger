import { describe, expect, it } from "vitest";
import {
  AI_SUBSCRIPTION_PRESETS,
  billingModelNeedsDueDate,
  formDefaultsFromCategory,
  SUBSCRIPTION_PRESET_GROUPS,
} from "./subscriptionPresets";

describe("subscription presets", () => {
  it("keeps ids unique and every preset structurally complete", () => {
    const ids = AI_SUBSCRIPTION_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(AI_SUBSCRIPTION_PRESETS.every((preset) => preset.plan && preset.category)).toBe(true);
    expect(
      AI_SUBSCRIPTION_PRESETS.every((preset) => SUBSCRIPTION_PRESET_GROUPS.includes(preset.group))
    ).toBe(true);
  });

  it("covers the primary AI subscription workflows without restoring a catalog", () => {
    expect(AI_SUBSCRIPTION_PRESETS.length).toBeGreaterThanOrEqual(60);
    expect(SUBSCRIPTION_PRESET_GROUPS).toEqual([
      "对话与助手",
      "AI 编程",
      "创作与媒体",
      "模型 API",
    ]);
    expect(AI_SUBSCRIPTION_PRESETS.some((preset) => preset.id === "chatgpt-plus")).toBe(true);
    expect(AI_SUBSCRIPTION_PRESETS.some((preset) => preset.id === "cursor-pro")).toBe(true);
    expect(AI_SUBSCRIPTION_PRESETS.some((preset) => preset.id === "midjourney-standard")).toBe(true);
    expect(AI_SUBSCRIPTION_PRESETS.some((preset) => preset.id === "qwen-api")).toBe(true);
  });

  it("keeps API usage presets separate from renewal subscriptions", () => {
    const api = AI_SUBSCRIPTION_PRESETS.filter((preset) => preset.plan.endsWith("API"));
    expect(api.length).toBeGreaterThan(15);
    expect(api.every((preset) => preset.billingModel === "按量计费" && preset.fee === "")).toBe(true);
    expect(api.every((preset) => !billingModelNeedsDueDate(preset.billingModel))).toBe(true);
  });

  it("maps legacy category values to the new independent concepts", () => {
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
});
