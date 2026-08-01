/**
 * Unified date utilities shared between CalendarPicker and core dates module
 * Centralizes date formatting, parsing, and conversion to avoid code duplication
 */
import { formatDate as _formatISO } from "@ai-sub/core";

/**
 * Convert ISO date string (YYYY-MM-DD) to Date object
 * Uses local noon (12:00:00) to avoid timezone offset issues
 */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
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

const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** 按语言给出「已选日期」的展示文案。 */
export function formatDateForLang(date: Date, lang: "zh-CN" | "en"): string {
  if (lang === "en") {
    return `${EN_MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
  return formatDateCN(date);
}

/** 按语言给出日历头部的「年月」。 */
export function formatYearMonthForLang(year: number, month: number, lang: "zh-CN" | "en"): string {
  if (lang === "en") return `${EN_MONTHS_SHORT[month]} ${year}`;
  return formatYearMonth(year, month);
}

/** "2026-07" → 「2026年7月」/「Jul 2026」。core 的 spendByMonth 只提供中文 label，
 *  这里改用它同时给出的结构化 monthKey 自行格式化。 */
export function formatMonthKeyForLang(monthKey: string, lang: "zh-CN" | "en"): string {
  const [y, m] = monthKey.split("-");
  const monthIdx = Number(m) - 1;
  if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return monthKey;
  return formatYearMonthForLang(Number(y), monthIdx, lang);
}

export const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** 按语言给出星期表头。 */
export function weekdaysForLang(lang: "zh-CN" | "en"): string[] {
  return lang === "en" ? WEEKDAYS_EN : WEEKDAYS_CN;
}

/**
 * Format year and month for calendar header
 * e.g., "2024年7月"
 */
export function formatYearMonth(year: number, month: number): string {
  return `${year}年${month + 1}月`;
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
