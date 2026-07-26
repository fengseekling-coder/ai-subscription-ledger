import { memo, useEffect, useMemo, useRef, useState } from "react";
import { feeDisplayParts, fmtMoney, setBudget, type AppState, type Summary } from "@ai-sub/core";
import { resolveLang, tFor } from "./i18n";

type Props = {
  state: AppState;
  summary: Summary;
  onCommit: (next: AppState) => void;
  /** full = 概览页完整看板；compact = 其它页顶部摘要 */
  variant?: "full" | "compact";
  language: AppState["language"];
};

export const Dashboard = memo(function Dashboard({
  state,
  summary,
  onCommit,
  variant = "full",
  language,
}: Props) {
  const t = tFor(resolveLang(language)).dashboard;
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
          ? t.overdue
          : summary.nearestLeft !== null
            ? t.daysLeft(summary.nearestLeft)
            : summary.nearestDueDate,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;

  const hasBudget = Number(state.budget) > 0;
  const budgetActionLabel = hasBudget ? t.editBudget : t.addBudget;

  const budgetUsedPct = useMemo(() => {
    const budget = Number(state.budget);
    if (!(budget > 0)) return summary.monthSpend > 0 ? 100 : 0;
    return Math.min(100, (summary.monthSpend / budget) * 100);
  }, [state.budget, summary.monthSpend]);

  const budgetBarFillClass =
    summary.monthSpend > Number(state.budget)
      ? " is-over"
      : budgetUsedPct >= 85
        ? " is-warn"
        : "";

  const budgetProgressBar = (
    <div className="metric__budget-bar" aria-hidden>
      <div
        className={"metric__budget-bar-fill" + budgetBarFillClass}
        style={{ width: `${budgetUsedPct}%` }}
      />
    </div>
  );

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
      <span className="metric__budget-prefix">{t.budgetPrefix}</span>
      <input
        ref={budgetInputRef}
        className="metric__budget-field"
        type="text"
        inputMode="decimal"
        value={draftBudget}
        aria-label={t.budgetInputAria}
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
      <span className="metric__budget-unit">{t.budgetUnit}</span>
    </div>
  ) : (
    <div className="metric__budget-meta">
      <span className="metric__budget-total">
        {t.totalBudget(fmtMoney(state.budget))}
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
      {hasBudget && budgetProgressBar}
      {budgetEditor}
    </>
  );

  if (variant === "compact") {
    const compactMonitors = state.monitors ?? [];
    const compactErrorCount = compactMonitors.filter((m) => m.status === "error").length;

    return (
      <div className="dashboard dashboard--compact" aria-label={t.summaryLabel}>
        <div className="summary-strip">
          <div className="summary-strip__item">
            <span className="summary-strip__label">{t.monthSpend}</span>
            <span className="summary-strip__value">{fmtMoney(summary.monthSpend)}</span>
          </div>
          <div
            className={
              "summary-strip__item summary-strip__item--budget" +
              (editingBudget ? " is-editing" : "")
            }
          >
            <span className="summary-strip__label">{t.budgetLeft}</span>
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
            <span className="summary-strip__label">{t.nextRenew}</span>
            <span
              className="summary-strip__value"
              style={nearestValueStyle ? { color: nearestValueStyle } : undefined}
            >
              {summary.nearestPlan ?? t.noRenew}
              {nearestSub && <span className="summary-strip__note">{" · "}{nearestSub}</span>}
            </span>
          </div>
          {compactErrorCount > 0 && (
            <div className="summary-strip__item">
              <span className="summary-strip__label">{t.monitor}</span>
              <span className="summary-strip__value" style={{ color: "var(--danger)" }}>
                {t.monitorErrors(compactErrorCount)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const monitors = state.monitors ?? [];
  const activeMonitors = monitors.filter((m) => m.status === "active").length;
  const errorMonitors = monitors.filter((m) => m.status === "error").length;
  const monitorDotClass = errorMonitors > 0
    ? "dashboard-monitor__dot--error"
    : activeMonitors > 0
      ? "dashboard-monitor__dot--ok"
      : "dashboard-monitor__dot--warn";

  return (
    <div className="dashboard">
      <section className="metrics">
        <article className="metric">
          <div className="metric__label">{t.monthSpend}</div>
          <div className="metric__value">{fmtMoney(summary.monthSpend)}</div>
        </article>
        <article className={"metric metric--budget" + (editingBudget ? " is-editing" : "")}>
          <div className="metric__label">{t.budgetLeft}</div>
          {budgetCardBody}
        </article>
        <article className="metric">
          <div className="metric__label">{t.nextRenew}</div>
          <div
            className="metric__value metric__value--sm"
            style={nearestValueStyle ? { color: nearestValueStyle } : undefined}
          >
            {summary.nearestPlan ?? t.noRenew}
          </div>
          {nearestSub && <div className="metric__note">{nearestSub}</div>}
        </article>
      </section>

      {monitors.length > 0 && (
        <div className="dashboard-monitor">
          <div className={`dashboard-monitor__dot ${monitorDotClass}`} />
          <span className="dashboard-monitor__text">
            {activeMonitors > 0
              ? t.monitorConnected(activeMonitors, errorMonitors)
              : t.monitorNotChecked}
          </span>
        </div>
      )}
    </div>
  );
});
