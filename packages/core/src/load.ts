import { defaultRowsSeed } from "./defaults.js";
import { ensureBillsFromRows, ensureSubscribedAtFromRows, applyRowMigrations, hydrateImportedState } from "./migrate.js";
import { normalizeRow } from "./normalize.js";
import type { AppState } from "./types.js";

/** 全新用户：空账本 */
export function createEmptyState(): AppState {
  return { budget: 500, rows: [], bills: [] };
}

/** 开发/单测/parity：带示例订阅（不会自动写入用户数据库） */
export function createDemoState(): AppState {
  const rows = defaultRowsSeed.map((r) => normalizeRow(r));
  applyRowMigrations(rows);
  const bills = ensureBillsFromRows(rows, []);
  ensureSubscribedAtFromRows(rows, bills);
  return { budget: 500, rows, bills };
}

/** @deprecated 使用 createDemoState（单测）或 createEmptyState（产品） */
export function createDefaultState(): AppState {
  return createDemoState();
}

export function loadFromJson(parsed: unknown): AppState {
  if (!parsed || typeof parsed !== "object") return createEmptyState();
  const p = parsed as { rows?: unknown[] };
  if (!Array.isArray(p.rows)) return createEmptyState();
  return hydrateImportedState(parsed as { budget?: unknown; rows?: unknown[]; bills?: unknown[] });
}