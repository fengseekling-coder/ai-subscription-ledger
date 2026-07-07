import { fmtMoney, setBudget, type AppState, type Summary } from "@ai-sub/core";

type Props = {
  state: AppState;
  summary: Summary;
  onCommit: (next: AppState) => void;
};

export function Dashboard({ state, summary, onCommit }: Props) {
  const countParts = [`有效 ${summary.activeCount}`];
  if (summary.expiredCount) countParts.push(`过期 ${summary.expiredCount}`);
  if (summary.unsubCount) countParts.push(`未订 ${summary.unsubCount}`);

  const barClass =
    summary.monthSpend > summary.budget ? "is-over" : summary.budgetPct >= 85 ? "is-warn" : "";

  return (
    <div className="dashboard">
      <div className="dashboard__meta">{countParts.join(" · ")}</div>
      <section className="metrics">
        <article className="metric">
          <div className="metric__label">本月支出</div>
          <div className="metric__value">{fmtMoney(summary.monthSpend)}</div>
          <div className="metric__note">按账单付款日</div>
        </article>
        <article className="metric">
          <div className="metric__label">预算剩余</div>
          <div
            className="metric__value"
            style={{ color: summary.budgetLeft >= 0 ? "var(--ok)" : "var(--danger)" }}
          >
            {fmtMoney(summary.budgetLeft)}
          </div>
        </article>
        <article className={`metric ${summary.nearestUrgent ? "metric--highlight" : ""}`}>
          <div className="metric__label">下一续费</div>
          <div
            className="metric__value metric__value--sm"
            style={{
              color:
                summary.nearestLeft !== null && summary.nearestLeft < 0
                  ? "var(--danger)"
                  : summary.nearestLeft !== null && summary.nearestLeft <= 3
                    ? "var(--warn)"
                    : undefined,
            }}
          >
            {summary.nearestPlan ?? "—"}
          </div>
          <div className="metric__note">
            {summary.nearestPlan
              ? `${summary.nearestDueDate} · ${
                  summary.nearestLeft !== null && summary.nearestLeft < 0
                    ? "已过期"
                    : "剩余 " + summary.nearestLeft + " 天"
                }`
              : "周期套餐请设置续费日"}
          </div>
        </article>
      </section>
      <div className="budget-bar">
        <div className="budget-bar__top">
          <span className="budget-bar__label">预算使用</span>
          <span className="budget-bar__nums">
            {fmtMoney(summary.monthSpend)} / {fmtMoney(summary.budget)}
          </span>
        </div>
        <div className="budget-bar__track">
          <div className={`budget-bar__fill ${barClass}`} style={{ width: `${summary.budgetPct}%` }} />
        </div>
        <div className="budget-bar__foot">
          <label className="budget-bar__input">
            月预算
            <input
              type="number"
              min={0}
              step={1}
              value={state.budget}
              onChange={(e) => onCommit(setBudget(state, Number(e.target.value)))}
            />
            元
          </label>
        </div>
      </div>
    </div>
  );
}