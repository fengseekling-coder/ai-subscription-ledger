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