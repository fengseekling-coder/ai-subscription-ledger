import { fmtMoney, spendByCategory, spendByMonth, type AppState } from "@ai-sub/core";
import { categoryLabel } from "./categoryLabel";
import { resolveLang, tFor } from "./i18n";
import { formatMonthKeyForLang } from "./utils/dateUtils";

export function StatsView({ state }: { state: AppState }) {
  const lang = resolveLang(state.language);
  const dict = tFor(lang);
  const t = dict.stats;
  const byCat = spendByCategory(state);
  const byMonth = spendByMonth(state, 6);
  const maxMonth = Math.max(1, ...byMonth.map((m) => m.total));

  return (
    <section className="section stats-section">
<div className="stats-grid">
        <div className="table-card">
          <h4 className="stats-subtitle">{t.byCategory}</h4>
          <table>
            <thead>
              <tr>
                <th>{t.category}</th>
                <th>{t.active}</th>
                <th>{t.monthSpend}</th>
                <th>{t.feeRef}</th>
              </tr>
            </thead>
            <tbody>
              {byCat.map((row) => (
                <tr key={row.category}>
                  <td>
                    <span className={`category ${row.cls}`}>
                      {categoryLabel(row.category, dict.form.categoryOptions)}
                    </span>
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
                    {t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-card">
          <h4 className="stats-subtitle">{t.last6Months}</h4>
          <ul className="month-bars">
            {byMonth.map((m) => (
              <li key={m.monthKey} className="month-bars__row">
                <span className="month-bars__label">{formatMonthKeyForLang(m.monthKey, lang)}</span>
                <div className="month-bars__track">
                  <div
                    className="month-bars__fill"
                    style={{ width: `${(m.total / maxMonth) * 100}%` }}
                  />
                </div>
                <span className="month-bars__value">
                  {fmtMoney(m.total)}
                  <span className="due-muted"> · {t.billCount(m.billCount)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
