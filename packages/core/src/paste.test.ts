import { describe, expect, it } from "vitest";
import { runConnectorPaste } from "./paste.js";

describe("pasted subscription data", () => {
  it("reads a ledger backup without depending on the old catalog", () => {
    const result = runConnectorPaste(
      "generic-bills-json",
      JSON.stringify({
        budget: 800,
        rows: [{ plan: "Claude Pro", category: "AI 服务" }],
        bills: [{ amount: 20, paidAt: "2026-07-01" }],
      })
    );

    expect(result.rows).toEqual([{ plan: "Claude Pro", category: "AI 服务" }]);
    expect(result.bills).toEqual([{ amount: 20, paidAt: "2026-07-01" }]);
  });

  it("extracts a bill from relay order text", () => {
    const result = runConnectorPaste(
      "relay-order-text",
      "订单 SAMPLE0002 · 2026-07-05 ¥20"
    );

    expect(result.bills).toHaveLength(1);
    expect(result.bills?.[0]).toMatchObject({
      amount: 20,
      paidAt: "2026-07-05",
      orderId: "SAMPLE0002",
    });
  });

  it("rejects unsupported JSON structures", () => {
    expect(() => runConnectorPaste("generic-bills-json", '{"data":[]}')).toThrow(
      "无法识别 JSON 结构"
    );
  });
});
