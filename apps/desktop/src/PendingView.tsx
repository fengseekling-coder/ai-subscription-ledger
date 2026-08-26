import {
  deleteRow,
  effectiveFee,
  feeDisplayParts,
  markUnrenewed,
  renewRow,
  type AppState,
  type SubscriptionRow,
} from "@ai-sub/core";
import { resolveLang, tFor } from "./i18n";
import type { RequestConfirmation } from "./ui/ConfirmDialog";

type PendingItem = { row: SubscriptionRow; index: number; left: number | null };

type Props = {
  state: AppState;
  pending: PendingItem[];
  onCommit: (next: AppState) => void;
  showNotice: (text: string, danger?: boolean) => void;
  onRequestConfirmation: RequestConfirmation;
};

/** 与订阅表同一套费用展示：美元保留 $ 并给出 ≈¥ 约价，避免把 $20 显示成 ¥20。 */
function feeLabel(fee: string): string {
  const { primary, approx } = feeDisplayParts(fee);
  return approx ? `${primary} ${approx}` : primary;
}

export function PendingView({ state, pending, onCommit, showNotice, onRequestConfirmation }: Props) {
  const dict = tFor(resolveLang(state.language));
  const t = dict.pending;
  const table = dict.table;
  return (
    <section className="section">
      <div className="table-card renew-list">
        {pending.map(({ row, index, left }) => (
          <div key={row.id} className="renew-item">
            <div>
              <div className="renew-item__plan">{row.plan}</div>
              <div className="renew-item__meta">
                {t.meta(row.dueDate, left ?? 0, feeLabel(effectiveFee(row)))}
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
                  showNotice(t.renewedNotice(row.plan));
                }}
              >
                {t.renewed}
              </button>
              <button
                type="button"
                onClick={() =>
                  onRequestConfirmation({
                    title: table.unrenewedTitle,
                    message: table.unrenewedPrompt(row.plan),
                    confirmLabel: table.delete,
                    secondaryLabel: table.unsubscribe,
                    dismissLabel: dict.common.close,
                    destructive: true,
                    onConfirm: () => {
                      const result = deleteRow(state, index);
                      if ("error" in result) {
                        showNotice(result.error, true);
                        return;
                      }
                      onCommit(result);
                    },
                    onSecondary: () => {
                      const result = markUnrenewed(state, index, "unsubscribe");
                      if ("error" in result) {
                        showNotice(result.error, true);
                        return;
                      }
                      onCommit(result);
                    },
                  })
                }
              >
                {t.notRenewed}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
