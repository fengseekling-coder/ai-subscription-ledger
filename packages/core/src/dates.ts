/** 格式化日期为 YYYY-MM-DD 格式 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 获取今天的 ISO 日期字符串 (YYYY-MM-DD) */
export function todayLocalISO(): string {
  const n = new Date();
  return formatDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
}

/** 获取当前月份键 (YYYY-MM 格式) */
export function currentMonthKey(ref = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 计算距离到期日还有多少天（向上取整）
 * @param iso 到期日的 ISO 日期字符串 (YYYY-MM-DD)
 * @param ref 参考日期（默认今天）
 * @returns 剩余天数，如果 iso 为空则返回 null
 */
export function daysUntil(iso: string | undefined | null, ref = new Date()): number | null {
  if (!iso) return null;
  // Parse iso as local noon to anchor both dates to the same timezone reference.
  // Using local time avoids UTC-offset drift (e.g., UTC+8: "2026-07-07" becomes
  // 20:00 UTC, not 00:00). Using noon anchors both dates to the same local day
  // so the comparison is timezone-independent: due is noon of the due day, now is
  // noon of today, and the ceiling-difference gives the calendar day count.
  const due = new Date(iso + "T12:00:00");
  const now = new Date(ref);
  now.setHours(12, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export function nextRecurringDueDate(
  iso: string | undefined,
  intervalMonths: number,
  ref = new Date()
): string {
  const now = new Date(ref);
  now.setHours(0, 0, 0, 0);
  const step =
    Number.isFinite(intervalMonths) && intervalMonths > 0 ? Math.floor(intervalMonths) : 1;
  // Use T12:00:00 to avoid timezone issues when parsing date-only strings
  let due = iso ? new Date(iso + "T12:00:00") : new Date(now);
  if (Number.isNaN(due.getTime())) due = new Date(now);
  do {
    due = addMonths(due, step);
  } while (due <= now);
  return formatDate(due);
}

export function nextMonthlyDueDate(iso: string | undefined, ref = new Date()): string {
  return nextRecurringDueDate(iso, 1, ref);
}

/**
 * 将用户输入规范为 YYYY-MM-DD，无效则返回 null；空串返回 ""。
 *
 * `ref` 是「今天」的参考时刻，只影响相对格式（今天/明天/昨天/+3/-5）。
 * 显式传入可让调用方（及其测试）不依赖真实时钟。
 */
export function normalizeDateInput(raw: unknown, ref = new Date()): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : s;
  }
  // Various separators: 2024/07/09, 2024.07.09, 2024年07月09日
  const m = s.match(/^(\d{4})[/.年](\d{1,2})[/.月](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = String(m[2]).padStart(2, "0");
    const day = String(m[3]).padStart(2, "0");
    const iso = `${y}-${mo}-${day}`;
    const d = new Date(iso + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  // Compact: 20240709
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const iso = `${compact[1]}-${compact[2]}-${compact[3]}`;
    const d = new Date(iso + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  // Relative dates
  const today = new Date(ref);
  const lower = s.toLowerCase();
  if (lower === "today" || lower === "今天") return formatDate(today);
  if (lower === "tomorrow" || lower === "明天") {
    const tm = new Date(today);
    tm.setDate(today.getDate() + 1);
    return formatDate(tm);
  }
  if (lower === "yesterday" || lower === "昨天") {
    const yd = new Date(today);
    yd.setDate(today.getDate() - 1);
    return formatDate(yd);
  }
  // Relative: +3, -5, +3天， -5天
  const relMatch = s.match(/^([+-]\d+)\s*(?:天|days?)?$/i);
  if (relMatch) {
    const days = parseInt(relMatch[1], 10);
    const dt = new Date(today);
    dt.setDate(today.getDate() + days);
    return formatDate(dt);
  }
  return null;
}

/** 验证日期格式是否有效，返回提示信息 */
export function validateDateInput(raw: unknown, ref = new Date()): { valid: boolean; message?: string; normalized?: string } {
  const result = normalizeDateInput(raw, ref);
  if (result === null) {
    return { valid: false, message: "日期格式无效，请使用 YYYY-MM-DD 或 今天/明天/+3 等格式" };
  }
  if (result === "") {
    return { valid: true, normalized: "" };
  }
  return { valid: true, normalized: result };
}

export function dueMeta(iso: string | undefined, ref = new Date()): { label: string; cls: string } {
  const left = daysUntil(iso, ref);
  if (left === null) return { label: "", cls: "" };
  if (left < 0) return { label: `已过期 ${Math.abs(left)} 天`, cls: "overdue" };
  if (left === 0) return { label: "今天到期", cls: "soon" };
  if (left <= 3) return { label: `剩余 ${left} 天`, cls: "soon" };
  return { label: `剩余 ${left} 天`, cls: "safe" };
}

/**
 * English short-month-name → "MM" lookup. Keys are lowercase and matched against
 * the first 3 letters of the input, so "jan", "Jan", "January", "jAnUaRy" all
 * resolve to "01".
 */
export const EN_MONTH_TO_NUM: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Match a free-form English-month date string like "16 Jul 2026",
 * "16th Jul, 2026", or "Jul 16, 2026". Returns ISO YYYY-MM-DD, or null if
 * no recognizable date is found.
 *
 * Day/month order is auto-detected by checking whether the first group is
 * a digit (DD Mon YYYY) or a month name (Mon DD YYYY).
 */
export function normalizeEnglishMonthDate(raw: string): string | null {
  const m1 = raw.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*,?\s*(\d{4})/i);
  const m2 = raw.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})/i);
  const hit = m1 || m2;
  if (!hit) return null;
  let day: string, month: string, year: string;
  if (m1 && /\d/.test(hit[1])) {
    day = hit[1].padStart(2, "0");
    month = EN_MONTH_TO_NUM[hit[2].toLowerCase().slice(0, 3)];
    year = hit[3];
  } else if (m2) {
    month = EN_MONTH_TO_NUM[hit[1].toLowerCase().slice(0, 3)];
    day = hit[2].padStart(2, "0");
    year = hit[3];
  } else {
    return null;
  }
  return month ? `${year}-${month}-${day}` : null;
}
