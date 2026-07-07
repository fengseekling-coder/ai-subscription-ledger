export function moneyValue(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const s = String(raw).replace(/[¥￥$,\s/月元]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n: number): string {
  const s = Math.abs(n).toFixed(1).replace(/\.0$/, "");
  return n < 0 ? `-¥${s}` : `¥${s}`;
}