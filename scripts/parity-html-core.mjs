/**
 * Phase 0 验收：用固定「今天」对 core 默认/迁移后状态打摘要，便于检查统计口径。
 * 用法：npm run build -w @ai-sub/core && node scripts/parity-html-core.mjs
 */
import { createDemoState, computeSummary, pendingRenewItems, fmtMoney } from "../packages/core/dist/index.js";

const ref = new Date(process.env.PARITY_REF ?? "2026-07-05T12:00:00");
const state = createDemoState();
const summary = computeSummary(state, ref);
const pending = pendingRenewItems(state.rows, ref);

const report = {
  ref: ref.toISOString().slice(0, 10),
  monthSpend: summary.monthSpend,
  monthSpendFmt: fmtMoney(summary.monthSpend),
  budgetLeft: summary.budgetLeft,
  budgetLeftFmt: fmtMoney(summary.budgetLeft),
  nearestPlan: summary.nearestPlan,
  nearestDueDate: summary.nearestDueDate,
  nearestLeft: summary.nearestLeft,
  pendingRenewCount: summary.pendingRenewCount,
  pendingPlans: pending.map((p) => p.row.plan),
  billCount: state.bills.length,
  rowCount: state.rows.length,
};

console.log(JSON.stringify(report, null, 2));
