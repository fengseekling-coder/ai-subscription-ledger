import { deleteBill, fmtMoney, subById, type AppState, type Bill } from "@ai-sub/core";
import { resolveLang, tFor } from "./i18n";

type Props = {
  state: AppState;
  bills: Bill[];
  onCommit: (next: AppState) => void;
  onNotice: (text: string, danger?: boolean) => void;
  onEdit: (billId: string) => void;
  language: AppState["language"];
};

export function BillsView({ state, bills, onCommit, onNotice, onEdit, language }: Props) {
  const t = tFor(resolveLang(language)).bills;
  return (
    <section className="section">
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>{t.date}</th>
              <th>{t.linkedSub}</th>
              <th>{t.amount}</th>
              <th>{t.orderId}</th>
              <th>{t.note}</th>
              <th aria-label={t.edit} />
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => {
              const sub = subById(state, bill.subscriptionId);
              return (
                <tr key={bill.id}>
                  <td>
                    <span className="date-display">{bill.paidAt}</span>
                  </td>
                  <td>
                    {sub?.plan ?? t.deletedSub}
                    {bill.kind === "renewal" && <span className="kind-tag">{t.renewalTag}</span>}
                  </td>
                  <td>
                    <span>{fmtMoney(bill.amount)}</span>
                  </td>
                  <td>
                    <span>{bill.orderId || <span className="due-muted">—</span>}</span>
                  </td>
                  <td>
                    <span>{bill.note || <span className="due-muted">—</span>}</span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => onEdit(bill.id)}
                        title={t.editTitle(sub?.plan ?? t.linkedSub)}
                      >
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t.confirmDelete)) {
                            onCommit(deleteBill(state, bill.id));
                            onNotice(t.deleted);
                          }
                        }}
                      >
                        {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
