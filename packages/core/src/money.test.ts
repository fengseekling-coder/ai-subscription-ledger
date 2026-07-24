import { describe, it, expect } from "vitest";
import { moneyValue, looksLikeUsdFee, feeDisplayParts } from "./money.js";

describe("moneyValue", () => {
  it("parses plain CNY", () => {
    expect(moneyValue("¥49")).toBe(49);
    expect(moneyValue("49")).toBe(49);
    expect(moneyValue("1,299")).toBe(1299);
  });

  it("parses USD-prefixed fees to the numeric amount (currency stripped)", () => {
    expect(moneyValue("US$20")).toBe(20);
    expect(moneyValue("USD 20")).toBe(20);
    expect(moneyValue("U.S.$20")).toBe(20);
    expect(moneyValue("US$20/month")).toBe(20);
    expect(moneyValue("$20")).toBe(20);
  });

  it("returns 0 for empty / null / non-numeric", () => {
    expect(moneyValue("")).toBe(0);
    expect(moneyValue(null)).toBe(0);
    expect(moneyValue(undefined)).toBe(0);
    expect(moneyValue("abc")).toBe(0);
  });
});

describe("looksLikeUsdFee", () => {
  it("detects USD fees, rejects CNY", () => {
    expect(looksLikeUsdFee("US$20")).toBe(true);
    expect(looksLikeUsdFee("USD 20")).toBe(true);
    expect(looksLikeUsdFee("¥49")).toBe(false);
    expect(looksLikeUsdFee("49")).toBe(false);
  });
});

describe("feeDisplayParts", () => {
  it("adds CNY approx for USD fees", () => {
    expect(feeDisplayParts("US$20")).toEqual({ primary: "$20", approx: "≈¥144" });
  });
  it("no approx for CNY fees", () => {
    expect(feeDisplayParts("¥49")).toEqual({ primary: "¥49", approx: null });
  });
});
