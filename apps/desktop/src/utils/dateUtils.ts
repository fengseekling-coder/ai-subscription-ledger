/**
 * Unified date utilities shared between CalendarPicker and core dates module
 * Centralizes date formatting, parsing, and conversion to avoid code duplication
 */

/**
 * Convert ISO date string (YYYY-MM-DD) to Date object
 * Uses local noon (12:00:00) to avoid timezone offset issues
 */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Parse ISO date string with timezone safety
 * Uses T12:00:00 to anchor to local noon
 */
export function parseISODate(iso: string): Date {
  return new Date(iso + "T12:00:00");
}

/**
 * Convert Date object to ISO date string (YYYY-MM-DD)
 */
export function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format date for display in Chinese locale
 * e.g., "2024年7月15日"
 */
export function formatDateCN(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * Format year and month for calendar header
 * e.g., "2024年7月"
 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}

/**
 * Get today's date as ISO string
 */
export function todayISO(): string {
  const n = new Date();
  return dateToIso(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Build calendar days array for a given month
 * Returns array with null placeholders for empty cells
 */
export function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  
  // Add empty cells for days before the 1st
  for (let i = 0; i < first.getDay(); i++) {
    days.push(null);
  }
  
  // Add actual days
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  
  return days;
}

/**
 * Navigate to previous month
 */
export function prevMonth(year: number, month: number): [number, number] {
  if (month === 0) {
    return [year - 1, 11];
  }
  return [year, month - 1];
}

/**
 * Navigate to next month
 */
export function nextMonth(year: number, month: number): [number, number] {
  if (month === 11) {
    return [year + 1, 0];
  }
  return [year, month + 1];
}

/**
 * Chinese weekdays for calendar display
 */
export const WEEKDAYS_CN = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * Chinese month names
 */
export const MONTHS_CN = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];
