import { deleteBill, fmtMoney, subById, type AppState, type Bill } from "@ai-sub/core";

type Props = {
  state: AppState;
  bills: Bill[];
  filteredBills: Bill[];
  monthBillCount: number;
  billMonthTotal: number;
  billAllTotal: number;
  onCommit: (next: AppState) => void;
};

export function BillsView({
  state,
  bills,
  filteredBills,
  monthBillCount,
  billMonthTotal,
  billAllTotal,
  onCommit,
}: Props) {
  return (
    <section className="section">
      <div className="section__head">
        <h3 className="section__title">账单</h3>
        <span className="section__hint">
          本月 {monthBillCount} 笔 · {fmtMoney(billMonthTotal)} · 全部 {bills.length} 笔 · {fmtMoney(billAllTotal)}
        </span>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>关联订阅</th>
              <th>金额</th>
              <th>订单号</th>
              <th>备注</th>
              <th aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {filteredBills.map((bill) => {
              const sub = subById(state, bill.subscriptionId);
              return (
                <tr key={bill.id}>
                  <td>
                    <span className="date-display">{bill.paidAt}</span>
                  </td>
                  <td>
                    {sub?.plan ?? "（已删除订阅）"}
                    {bill.kind === "renewal" && <span className="kind-tag">续费</span>}
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
                        onClick={() => {
                          if (confirm("确定删除这笔账单？")) onCommit(deleteBill(state, bill.id));
                        }}
                      >
                        删
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