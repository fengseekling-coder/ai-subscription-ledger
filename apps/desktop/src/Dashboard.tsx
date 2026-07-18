import { memo, useEffect, useMemo, useRef, useState } from "react";
import { feeDisplayParts, fmtMoney, setBudget, type AppState, type Summary } from "@ai-sub/core";

type Props = {
  state: AppState;
  summary: Summary;
  onCommit: (next: AppState) => void;
  /** full = 概览页完整看板；compact = 其它页顶部摘要 */
  variant?: "full" | "compact";
};

export const Dashboard = memo(function Dashboard({
  state,
  summary,
  onCommit,
  variant = "full",
}: Props) {
  const [editingBudget, setEditingBudget] = useState(false);
  const [draftBudget, setDraftBudget] = useState(String(state.budget));
  const budgetInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingBudget) {
      setDraftBudget(String(state.budget));
    }
  }, [state.budget, editingBudget]);

  useEffect(() => {
    if (editingBudget) {
      budgetInputRef.current?.focus();
      budgetInputRef.current?.select();
    }
  }, [editingBudget]);

  const nearestValueStyle = useMemo(() => {
    if (summary.nearestLeft !== null && summary.nearestLeft < 0) return "var(--danger)";
    if (summary.nearestLeft !== null && summary.nearestLeft <= 3) return "var(--warn)";
    return undefined;
  }, [summary.nearestLeft]);

  const nearestFeeLabel = useMemo(() => {
    if (!summary.nearestFee) return null;
    const { primary } = feeDisplayParts(summary.nearestFee);
    return primary === "—" ? null : primary;
  }, [summary.nearestFee]);

  const nearestSub = summary.nearestPlan
    ? [
        nearestFeeLabel,
        summary.nearestLeft !== null && summary.nearestLeft < 0
          ? "已过期"
          : summary.nearestLeft !== null
            ? `剩余 ${summary.nearestLeft} 天`
            : summary.nearestDueDate,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;

  const hasBudget = Number(state.budget) > 0;
  const budgetActionLabel = hasBudget ? "编辑预算" : "添加预算";

  const commitBudgetDraft = () => {
    const v = Number(draftBudget);
    if (Number.isFinite(v) && v >= 0) {
      onCommit(setBudget(state, v));
    } else {
      setDraftBudget(String(state.budget));
    }
    setEditingBudget(false);
  };

  const cancelBudgetEdit = () => {
    setDraftBudget(String(state.budget));
    setEditingBudget(false);
  };

  const budgetEditor = editingBudget ? (
    <div className="metric__budget-edit">
      <span className="metric__budget-prefix">总预算</span>
      <input
        ref={budgetInputRef}
        className="metric__budget-field"
        type="text"
        inputMode="decimal"
        value={draftBudget}
        aria-label="月预算"
        onChange={(e) => setDraftBudget(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commitBudgetDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitBudgetDraft();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelBudgetEdit();
          }
        }}
      />
      <span className="metric__budget-unit">元</span>
    </div>
  ) : (
    <div className="metric__budget-meta">
      <span className="metric__budget-total">
        总预算 {fmtMoney(state.budget)}
      </span>
      <button
        type="button"
        className="metric__budget-action"
        onClick={() => setEditingBudget(true)}
      >
        {budgetActionLabel}
      </button>
    </div>
  );

  const budgetCardBody = (
    <>
      <div
        className={
          "metric__value" + (summary.budgetLeft >= 0 ? " is-ok" : " is-danger")
        }
      >
        {fmtMoney(summary.budgetLeft)}
      </div>
      {budgetEditor}
    </>
  );

  if (variant === "compact") {
    return (
      <div className="dashboard dashboard--compact" aria-label="本月摘要">
        <div className="summary-strip">
          <div className="summary-strip__item">
            <span className="summary-strip__label">本月支出</span>
            <span className="summary-strip__value">{fmtMoney(summary.monthSpend)}</span>
          </div>
          <div
            className={
              "summary-strip__item summary-strip__item--budget" +
              (editingBudget ? " is-editing" : "")
            }
          >
            <span className="summary-strip__label">预算剩余</span>
            <span
              className={
                "summary-strip__value" +
                (summary.budgetLeft >= 0 ? " is-ok" : " is-danger")
              }
            >
              {fmtMoney(summary.budgetLeft)}
            </span>
            {budgetEditor}
          </div>
          <div className="summary-strip__item summary-strip__item--grow">
            <span className="summary-strip__label">下一续费</span>
            <span
              className="summary-strip__value"
              style={nearestValueStyle ? { color: nearestValueStyle } : undefined}
            >
              {summary.nearestPlan ?? "—"}
              {nearestSub && <span className="summary-strip__note">{" · "}{nearestSub}</span>}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="metrics">
        <article className="metric">
          <div className="metric__label">本月支出</div>
          <div className="metric__value">{fmtMoney(summary.monthSpend)}</div>
        </article>
        <article className={"metric metric--budget" + (editingBudget ? " is-editing" : "")}>
          <div className="metric__label">预算剩余</div>
          {budgetCardBody}
        </article>
        <article className="metric">
          <div className="metric__label">下一续费</div>
          <div
            className="metric__value metric__value--sm"
            style={nearestValueStyle ? { color: nearestValueStyle } : undefined}
          >
            {summary.nearestPlan ?? "—"}
          </div>
          {nearestSub && <div className="metric__note">{nearestSub}</div>}
        </article>
      </section>
    </div>
  );
});
