import {
  deleteRow,
  fmtMoney,
  markUnrenewed,
  moneyValue,
  renewRow,
  type AppState,
  type SubscriptionRow,
} from "@ai-sub/core";
import { confirmUnrenewedOrDelete } from "./SubTable";

type PendingItem = { row: SubscriptionRow; index: number; left: number | null };

type Props = {
  state: AppState;
  pending: PendingItem[];
  onCommit: (next: AppState) => void;
  showNotice: (text: string, danger?: boolean) => void;
};

export function PendingView({ state, pending, onCommit, showNotice }: Props) {
  return (
    <section className="section">
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
                  const result = renewRow(state, index);
                  if ("error" in result) {
                    showNotice(result.error, true);
                    return;
                  }
                  onCommit(result);
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
                    () => {
                      const result = deleteRow(state, index);
                      if ("error" in result) {
                        showNotice(result.error, true);
                        return;
                      }
                      onCommit(result);
                    },
                    () => {
                      const result = markUnrenewed(state, index, "unsubscribe");
                      if ("error" in result) {
                        showNotice(result.error, true);
                        return;
                      }
                      onCommit(result);
                    }
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
