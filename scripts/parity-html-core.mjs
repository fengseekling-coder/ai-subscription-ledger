/**
 * 统计口径回归守卫：用固定「今天」对 core 默认状态打摘要，并与提交在仓库里的
 * 基准快照 `parity-baseline.json` 比对。不一致就打印差异并以非零码退出。
 *
 * 用法：
 *   npm run parity                  # 比对基准，漂移则失败
 *   npm run parity -- --update      # 认可当前输出，重写基准（改动统计口径后用）
 *   PARITY_REF=2026-01-01 npm run parity   # 换参考日期探查，跳过比对
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDemoState, computeSummary, pendingRenewItems, fmtMoney } from "../packages/core/dist/index.js";

const DEFAULT_REF = "2026-07-05T12:00:00";
const BASELINE_PATH = fileURLToPath(new URL("./parity-baseline.json", import.meta.url));

const refInput = process.env.PARITY_REF ?? DEFAULT_REF;
const ref = new Date(refInput);
if (Number.isNaN(ref.getTime())) {
  console.error(`PARITY_REF 不是合法日期： ${refInput}`);
  process.exit(2);
}

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

const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (process.argv.includes("--update")) {
  writeFileSync(BASELINE_PATH, serialized);
  console.log(serialized.trimEnd());
  console.log("\n✔ 基准已更新：scripts/parity-baseline.json（请连同代码改动一起提交）");
  process.exit(0);
}

// 自定义参考日期只用于人工探查，基准是按 DEFAULT_REF 生成的，不参与比对。
if (refInput !== DEFAULT_REF) {
  console.log(serialized.trimEnd());
  console.log(`\nℹ PARITY_REF=${refInput}（非默认参考日期），跳过基准比对。`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
} catch (e) {
  console.error(serialized.trimEnd());
  console.error(`\n✘ 读不到基准文件 scripts/parity-baseline.json（${e.message}）。`);
  console.error("  首次建立基准请运行：npm run parity -- --update");
  process.exit(1);
}

const norm = (v) => JSON.stringify(v);
const keys = [...new Set([...Object.keys(baseline), ...Object.keys(report)])];
const drift = keys
  .filter((k) => norm(baseline[k]) !== norm(report[k]))
  .map((k) => ({ key: k, expected: norm(baseline[k]), actual: norm(report[k]) }));

if (drift.length === 0) {
  console.log(serialized.trimEnd());
  console.log(`\n✔ 统计口径与基准一致（ref=${report.ref}，共 ${keys.length} 项）。`);
  process.exit(0);
}

console.error(`✘ 统计口径与基准不一致（ref=${report.ref}），${drift.length} 项漂移：\n`);
for (const d of drift) {
  console.error(`  ${d.key}`);
  console.error(`    基准： ${d.expected}`);
  console.error(`    当前： ${d.actual}`);
}
console.error("\n如果这是预期改动，运行 npm run parity -- --update 重写基准并提交。");
process.exit(1);
