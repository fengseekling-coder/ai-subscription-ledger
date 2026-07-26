/** 展示用参考汇率（美元 → 人民币）。仅用于表格约价，不参与预算计算。 */
export const USD_CNY_RATE = 7.2;

export function moneyValue(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const s = String(raw)
    .replace(/\bU\.?S\.?D?\s*\$?\s*/gi, "") // 去掉 US$ / USD / U.S.$ 等美元前缀，避免残留字母使 parseFloat 得 NaN
    .replace(/[¥￥$,\s/月元]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 费用字符串 → 以人民币为单位的金额：美元按参考汇率折算，人民币原值返回。
 *
 * 账本里一切「进入统计的金额」都必须过这里，否则同一份数据会出现两套货币基准
 * （例如账单按 ¥144 入库、统计页的月费参考却按 ¥20 算，同一张表里差 7.2 倍）。
 * 放在 money.ts 而非某个调用方内部，就是为了让 actions / analytics 共用一份口径。
 */
export function feeToCnyAmount(fee: string | number | null | undefined): number {
  const v = moneyValue(fee);
  if (v <= 0) return 0;
  return looksLikeUsdFee(fee) ? Math.round(v * USD_CNY_RATE * 100) / 100 : v;
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
