import { fmtMoney, spendByCategory, spendByMonth, type AppState } from "@ai-sub/core";

export function StatsView({ state }: { state: AppState }) {
  const byCat = spendByCategory(state);
  const byMonth = spendByMonth(state, 6);
  const maxMonth = Math.max(1, ...byMonth.map((m) => m.total));

  return (
    <section className="section stats-section">
      <div className="section__head">
        <h3 className="section__title">统计</h3>
        <span className="section__hint">本月按账单付款日 · 月费为有效订阅标价合计</span>
      </div>

      <div className="stats-grid">
        <div className="table-card">
          <h4 className="stats-subtitle">按分类（本月支出）</h4>
          <table>
            <thead>
              <tr>
                <th>分类</th>
                <th>有效</th>
                <th>本月支出</th>
                <th>月费参考</th>
              </tr>
            </thead>
            <tbody>
              {byCat.map((row) => (
                <tr key={row.category}>
                  <td>
                    <span className={`category ${row.cls}`}>{row.category}</span>
                  </td>
                  <td>
                    {row.activeCount}/{row.count}
                  </td>
                  <td>{fmtMoney(row.monthSpend)}</td>
                  <td className="due-muted">{fmtMoney(row.feeMonthlyEst)}</td>
                </tr>
              ))}
              {byCat.length === 0 && (
                <tr>
                  <td colSpan={4} className="due-muted">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <h4 className="stats-subtitle">近 6 个月支出</h4>
          <ul className="month-bars">
            {byMonth.map((m) => (
              <li key={m.monthKey} className="month-bars__row">
                <span className="month-bars__label">{m.label}</span>
                <div className="month-bars__track">
                  <div
                    className="month-bars__fill"
                    style={{ width: `${(m.total / maxMonth) * 100}%` }}
                  />
                </div>
                <span className="month-bars__value">
                  {fmtMoney(m.total)}
                  <span className="due-muted"> · {m.billCount} 笔</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}