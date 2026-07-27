import { describe, expect, it } from "vitest";
import { billingModelNeedsDueDate, formDefaultsFromCategory } from "./subscriptionFields";

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
    expect(billingModelNeedsDueDate("年付")).toBe(true);
    expect(billingModelNeedsDueDate("按量计费")).toBe(false);
    expect(billingModelNeedsDueDate("额度包")).toBe(false);
  });
});
