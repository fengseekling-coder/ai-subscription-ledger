/** 展示用参考汇率（美元 → 人民币）。仅用于表格约价，不参与预算计算。 */
export const USD_CNY_RATE = 7.2;

export function moneyValue(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const s = String(raw).replace(/[¥￥$,\s/月元]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n: number): string {
  // Display currency with appropriate precision:
  // - Whole numbers show without decimal: 100 → "¥100"
  // - Fractional numbers show up to 2 decimals: 99.5 → "¥99.5", 99.99 → "¥99.99"
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const rounded = Math.round(abs * 100) / 100;
  // Use Number.isInteger to avoid IEEE 754 floating-point artifacts from % 1.
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${sign}¥${s}`;
}

/** 表格展示用：去掉 US$/USD 等冗余前缀，保留 $ / ¥ 与原文数字 */
export function fmtFeeDisplay(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  // US$20 / USD$20 / U.S.$20 → $20
  let out = s.replace(/\bU\.?S\.?\s*\$/gi, "$");
  // USD 20 / USD20 → $20
  out = out.replace(/\bUSD\s*(?=\d)/gi, "$");
  // $ 20 → $20
  out = out.replace(/\$\s+(?=\d)/g, "$");
  return out;
}

/** 是否像美元金额（含 $ / USD / US$） */
export function looksLikeUsdFee(raw: unknown): boolean {
  const s = String(raw ?? "");
  return /\$|USD|U\.?S\.?/i.test(s) && /\d/.test(s);
}

/**
 * 表格金额主文案 + 可选约合人民币。
 * - `$20` → primary `$20`, approx `≈¥144`
 * - `¥49` / `49` → primary 原文，无约价
 */
export function feeDisplayParts(
  raw: unknown,
  rate = USD_CNY_RATE
): { primary: string; approx: string | null } {
  const primary = fmtFeeDisplay(raw);
  if (primary === "—") return { primary, approx: null };
  if (!looksLikeUsdFee(raw)) return { primary, approx: null };
  const n = moneyValue(raw);
  if (!(n > 0)) return { primary, approx: null };
  return { primary, approx: `≈${fmtMoney(n * rate)}` };
}
