import { describe, expect, it } from "vitest";
import { loadFromJson } from "./load.js";

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
    const out = loadFromJson({ budget: "nope", rows: [], bills: [] });
    expect(out.budget).toBe(500);
  });
});
