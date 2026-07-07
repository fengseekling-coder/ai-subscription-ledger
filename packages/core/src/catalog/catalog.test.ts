import { describe, expect, it } from "vitest";
import { listCatalog, rowFromCatalogId, runConnectorPaste, mergeConnectorResult } from "./index.js";
import { createDefaultState } from "../load.js";

describe("catalog", () => {
  it("lists auto-first with paste entries on top", () => {
    const all = listCatalog({ autoFirst: true });
    const firstPaste = all.findIndex((e) => e.syncTier === "paste");
    const firstNone = all.findIndex((e) => e.syncTier === "none");
    expect(firstPaste).toBeGreaterThanOrEqual(0);
    if (firstNone >= 0) expect(firstPaste).toBeLessThan(firstNone);
  });

  it("relay text creates bills", () => {
    const raw = "订单 SAMPLE0002 · 2026-07-05 ¥20";
    const r = runConnectorPaste("relay-order-text", raw);
    expect(r.bills?.length).toBeGreaterThan(0);
    const state = mergeConnectorResult(createDefaultState(), r);
    expect(state.bills.length).toBeGreaterThan(createDefaultState().bills.length);
  });

  it("rowFromCatalogId chatgpt", () => {
    const row = rowFromCatalogId("chatgpt-plus", true);
    expect(row?.plan).toContain("ChatGPT");
    expect(row?.subscribed).toBe(true);
  });
});
