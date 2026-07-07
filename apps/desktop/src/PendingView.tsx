import {
  deleteRow,
  fmtMoney,
  markUnrenewed,
  moneyValue,
  renewRow,
  type AppState,
  type Summary,
  type SubscriptionRow,
} from "@ai-sub/core";
import { confirmUnrenewedOrDelete } from "./SubTable";

type PendingItem = { row: SubscriptionRow; index: number; left: number | null };

type Props = {
  state: AppState;
  pending: PendingItem[];
  summary: Summary;
  onCommit: (next: AppState) => void;
  showNotice: (text: string, danger?: boolean) => void;
};

export function PendingView({ state, pending, summary, onCommit, showNotice }: Props) {
  return (
    <section className="section">
      <div className="section__head">
        <h3 className="section__title">待续费</h3>
        <span className="section__hint">
          {pending.length} 项 · {summary.pendingFirstPlan ?? "—"} {summary.pendingFirstNote ?? ""}
        </span>
      </div>
      <div className="table-card renew-list">
        {pending.map(({ row, index, left }) => (
          <div key={row.id} className="renew-item">
            <div>
              <div className="renew-item__plan">{row.plan}</div>
              <div className="renew-item__meta">
                {row.dueDate} · 剩余 {left} 天 · {fmtMoney(moneyValue(row.fee))}
              </div>
            </div>
            <div className="due-row-actions" style={{ display: "inline-flex" }}>
              <button
                type="button"
                onClick={() => {
                  onCommit(renewRow(state, index));
                  showNotice(`${row.plan} 已续费`);
                }}
              >
                已续费
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmUnrenewedOrDelete(
                    row.plan,
                    () => onCommit(deleteRow(state, index)),
                    () => onCommit(markUnrenewed(state, index, "unsubscribe"))
                  )
                }
              >
                未续费
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}