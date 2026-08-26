import { memo, useCallback, useMemo } from "react";
import {
  daysUntil,
  dueMeta,
  effectiveFee,
  feeDisplayParts,
  isCreditLike,
  type AppState,
  type SubscriptionRow,
} from "@ai-sub/core";
import { resolveLang, tFor, type Dict } from "./i18n";

export type SubTableHandlers = {
  onToggle: (index: number) => void;
  onEdit: (index: number) => void;
  onPickDue: (index: number) => void;
  onRenew: (index: number) => void;
  onMarkUnrenewed: (index: number) => void;
  onMarkExpired: (index: number) => void;
  onClearExpired: (index: number) => void;
  onDelete: (index: number) => void;
};

type SubTableRowProps = {
  row: SubscriptionRow;
  index: number;
  handlers: SubTableHandlers;
  t: Dict["table"];
};

const SubTableRow = memo(function SubTableRow({
  row,
  index,
  handlers,
  t,
}: SubTableRowProps) {
  const {
    onToggle,
    onEdit,
    onPickDue,
    onRenew,
    onMarkUnrenewed,
    onMarkExpired,
    onClearExpired,
    onDelete,
  } = handlers;

  const dueDate = String(row.dueDate || "").trim();

  // dueMeta 只取 cls（结构化的配色档位）；文案改由字典按剩余天数拼，
  // 这样不必让 core 返回本地化字符串。
  const due = useMemo(() => dueMeta(dueDate), [dueDate]);
  const dueLabel = useMemo(() => {
    const left = daysUntil(dueDate);
    if (left === null) return due.label;
    if (left < 0) return t.overdueDays(Math.abs(left));
    if (left === 0) return t.dueToday;
    return t.daysLeft(left);
  }, [dueDate, due.label, t]);
  // 实付为可选覆盖项：设置了实付（含 0）时，金额列只显示实付，避免重复展示定价。
  const hasActual = String(row.actualFee ?? "").trim() !== "";
  const effectiveFeeStr = effectiveFee(row);
  const effectiveParts = useMemo(() => feeDisplayParts(effectiveFeeStr), [effectiveFeeStr]);
  const plan = String(row.plan || "").trim();
  const note = String(row.usage || "").trim();
  const billTypeStyle = {
    class: row.includeInBudget === false ? "category-tag--other" : "category-tag--ai",
    label: row.includeInBudget === false ? t.regularBill : t.budgetBill,
  };

  const handleToggle = useCallback(() => onToggle(index), [onToggle, index]);
  const handleEdit = useCallback(() => onEdit(index), [onEdit, index]);
  const handlePickDue = useCallback(() => onPickDue(index), [onPickDue, index]);
  const handleRenew = useCallback(() => onRenew(index), [onRenew, index]);
  const handleMarkUnrenewed = useCallback(() => onMarkUnrenewed(index), [onMarkUnrenewed, index]);
  const handleMarkExpired = useCallback(() => onMarkExpired(index), [onMarkExpired, index]);
  const handleClearExpired = useCallback(() => onClearExpired(index), [onClearExpired, index]);
  const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);

  const dueBadgeClass =
    due.cls === "overdue"
      ? "due-badge--overdue"
      : due.cls === "soon"
        ? "due-badge--warn"
        : "due-badge--ok";

  const rowOpacity = row.expired
    ? "list-item--expired"
    : !row.subscribed
      ? "list-item--unsubscribed"
      : "";

  return (
    <tr className={`list-item ${rowOpacity}`}>
      <td className="subscription-list__category">
        <span className={`category-tag ${billTypeStyle.class}`}>{billTypeStyle.label}</span>
      </td>

      <td className="subscription-list__plan-cell" title={plan || undefined}>
        <span className="subscription-list__plan">
          {plan || <span className="text-tertiary">—</span>}
        </span>
      </td>

      <td className="subscription-list__fee cell-fee">
        <span className="cell-fee__main">{effectiveParts.primary}</span>
        {!hasActual && effectiveParts.approx && <span className="cell-fee__approx">{effectiveParts.approx}</span>}
      </td>

      <td className="subscription-list__note cell-note">
        {note || <span className="text-tertiary">—</span>}
      </td>

      <td className="subscription-list__status">
        <div className="subscription-list__status-content">
          {!row.subscribed ? (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={handleToggle}
              title={t.subscribeTitle}
            >
              {t.subscribe}
            </button>
          ) : row.expired && !dueDate ? (
            <div className="due-actions">
              <span className={`due-badge ${dueBadgeClass}`}>{t.expired}</span>
              <div className="due-actions__btns">
                <button type="button" className="btn btn--sm" onClick={handleClearExpired}>
                  {t.restore}
                </button>
                <button type="button" className="btn btn--sm btn--danger" onClick={handleDelete}>
                  {t.delete}
                </button>
              </div>
            </div>
          ) : isCreditLike(row) ? (
            <span className="text-tertiary">{t.nonCycle}</span>
          ) : !dueDate ? (
            <div className="due-actions">
              <button type="button" className="btn btn--sm btn--ghost" onClick={handlePickDue}>
                {t.setDate}
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={handleMarkExpired}>
                {t.expired}
              </button>
            </div>
          ) : (
            <div className="due-actions">
              <span className={`due-badge ${dueBadgeClass}`} title={dueDate}>
                {dueLabel}
              </span>
              {due.cls === "overdue" && (
                <div className="due-actions__btns">
                  <button type="button" className="btn btn--sm" onClick={handleRenew}>
                    {t.renewed}
                  </button>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={handleMarkUnrenewed}>
                    {t.cancel}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </td>

      <td className="subscription-list__date-cell">
        {dueDate ? (
          <time className="subscription-list__date" dateTime={dueDate}>
            {dueDate}
          </time>
        ) : (
          <span className="text-tertiary">—</span>
        )}
      </td>

      <td className="cell-actions">
        <button type="button" className="btn btn--sm btn--ghost cell-actions__btn" onClick={handleEdit}>
          {t.edit}
        </button>
      </td>
    </tr>
  );
});

export const SubTable = memo(function SubTable({
  entries,
  language,
  ...handlers
}: {
  entries: { row: SubscriptionRow; index: number }[];
  language: AppState["language"];
} & SubTableHandlers) {
  const dict = tFor(resolveLang(language));
  const t = dict.table;
  const empty = dict.empty;
  const {
    onToggle,
    onEdit,
    onPickDue,
    onRenew,
    onMarkUnrenewed,
    onMarkExpired,
    onClearExpired,
    onDelete,
  } = handlers;

  const stableHandlers = useMemo(
    () => ({
      onToggle,
      onEdit,
      onPickDue,
      onRenew,
      onMarkUnrenewed,
      onMarkExpired,
      onClearExpired,
      onDelete,
    }),
    [onToggle, onEdit, onPickDue, onRenew, onMarkUnrenewed, onMarkExpired, onClearExpired, onDelete]
  );

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__title">{empty.title}</div>
        <div className="empty-state__desc">{empty.desc}</div>
      </div>
    );
  }

  return (
    <div className="list-container">
      <table className="subscription-list">
        <colgroup>
          <col className="subscription-list__col subscription-list__col--category" />
          <col className="subscription-list__col subscription-list__col--plan" />
          <col className="subscription-list__col subscription-list__col--fee" />
          <col className="subscription-list__col subscription-list__col--note" />
          <col className="subscription-list__col subscription-list__col--status" />
          <col className="subscription-list__col subscription-list__col--due-date" />
          <col className="subscription-list__col subscription-list__col--actions" />
        </colgroup>
        <thead>
          <tr className="list-header">
            <th className="list-header__cell" scope="col">{t.billType}</th>
            <th className="list-header__cell" scope="col">{t.plan}</th>
            <th className="list-header__cell subscription-list__fee-header" scope="col">{t.fee}</th>
            <th className="list-header__cell" scope="col">{t.note}</th>
            <th className="list-header__cell" scope="col">{t.remain}</th>
            <th className="list-header__cell" scope="col">{t.dueDate}</th>
            <th className="list-header__cell subscription-list__actions-header" scope="col">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ row, index }) => (
            <SubTableRow
              key={row.id}
              row={row}
              index={index}
              handlers={stableHandlers}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});
