/**
 * @module @ai-sub/core
 *
 * AI 订阅账本核心业务逻辑库
 * 
 * 提供订阅管理、账单记账、续费提醒、预算统计等功能的核心算法与数据模型。
 * 无 UI 依赖，可在 Node.js 和浏览器环境运行。
 */

export type * from "./types.js";
export { newId } from "./ids.js";

/**
 * 日期处理工具函数
 * - formatDate: YYYY-MM-DD 格式化
 * - daysUntil: 计算剩余天数
 * - normalizeDateInput: 多种日期格式解析
 */
export * from "./dates.js";
export * from "./money.js";
export * from "./normalize.js";
export * from "./rules.js";
export * from "./stats.js";
export * from "./actions.js";
export * from "./load.js";
export * from "./views.js";
export * from "./analytics.js";
export * from "./paste.js";
/**
 * 数据统计与分析
 * - computeSummary: 计算月度摘要
 * - pendingRenewItems: 获取待续期列表
 * - monthSpendFromBillsOnly: 月支出统计
 */
export * from "./analytics.js";

/**
 * @ai-sub/core - AI Subscription Tracker Core Library
 *
 * This package provides the core business logic for the AI subscription tracker application.
 * It offers:
 * - Subscription management with due date tracking
 * - Bill recording and reconciliation
 * - Auto-renewal reminders
 * - Monthly budget statistics
 * - Data import from various sources (clipboard, OCR)
 *
 * No UI dependencies. Pure functional approach with state persistence support.
 *
 * Usage example:
 * ```typescript
 * import { newId, toggleSubscribe, addBillWithDetails } from '@ai-sub/core';
 * const newState = toggleSubscribe(appState, 'sub-id', true);
 * ```
 */
