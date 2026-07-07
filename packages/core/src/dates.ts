export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayLocalISO(): string {
  const n = new Date();
  return formatDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
}

export function currentMonthKey(ref = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
}

export function daysUntil(iso: string | undefined | null, ref = new Date()): number | null {
  if (!iso) return null;
  const due = new Date(iso + "T00:00:00");
  const now = new Date(ref);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export function nextMonthlyDueDate(iso: string | undefined, ref = new Date()): string {
  const now = new Date(ref);
  now.setHours(0, 0, 0, 0);
  let due = iso ? new Date(iso + "T00:00:00") : new Date(now);
  if (Number.isNaN(due.getTime())) due = new Date(now);
  do {
    due = addMonths(due, 1);
  } while (due <= now);
  return formatDate(due);
}

/** 将用户输入规范为 YYYY-MM-DD，无效则返回 null；空串返回 "" */
export function normalizeDateInput(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : s;
  }
  const m = s.match(/^(\d{4})[/.年](\d{1,2})[/.月](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = String(m[2]).padStart(2, "0");
    const day = String(m[3]).padStart(2, "0");
    const iso = `${y}-${mo}-${day}`;
    const d = new Date(iso + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

export function dueMeta(iso: string | undefined, ref = new Date()): { label: string; cls: string } {
  const left = daysUntil(iso, ref);
  if (left === null) return { label: "", cls: "" };
  if (left < 0) return { label: `已过期 ${Math.abs(left)} 天`, cls: "overdue" };
  if (left === 0) return { label: "今天到期", cls: "soon" };
  if (left <= 3) return { label: `剩余 ${left} 天`, cls: "soon" };
  return { label: `剩余 ${left} 天`, cls: "safe" };
}