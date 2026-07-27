import { memo, useCallback, useMemo } from "react";
import {
  daysUntil,
  dueMeta,
  feeDisplayParts,
  categoryClass,
  isCreditLike,
  type AppState,
  type SubscriptionRow,
} from "@ai-sub/core";
import { categoryLabel } from "./categoryLabel";
import { resolveLang, tFor, type Dict } from "./i18n";

const ReadCell = memo(function ReadCell({
  value,
  className,
  empty = "dash",
}: {
  value: string;
  className?: string;
  /** dash = show — ; blank = leave empty */
  empty?: "dash" | "blank";
}) {
  const v = (value || "").trim();
  return (
    <td className={className ?? ""} title={v || undefined}>
      {v ? v : empty === "blank" ? null : <span className="text-tertiary">—</span>}
    </td>
  );
});

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
  categoryLabels: Dict["form"]["categoryOptions"];
};

const SubTableRow = memo(function SubTableRow({
  row,
  index,
  handlers,
  t,
  categoryLabels,
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

  // dueMeta 只取 cls（结构化的配色档位）；文案改由字典按剩余天数拼，
  // 这样不必让 core 返回本地化字符串。
  const due = useMemo(() => dueMeta(row.dueDate), [row.dueDate]);
  const dueLabel = useMemo(() => {
    const left = daysUntil(row.dueDate);
    if (left === null) return due.label;
    if (left < 0) return t.overdueDays(Math.abs(left));
    if (left === 0) return t.dueToday;
    return t.daysLeft(left);
  }, [row.dueDate, due.label, t]);
  const feeParts = useMemo(() => feeDisplayParts(row.fee), [row.fee]);
  const categoryStyle = {
    class: `category-tag--${categoryClass(row.category)}`,
    label: categoryLabel(row.category, categoryLabels),
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
      <td>
        <span className={`category-tag ${categoryStyle.class}`}>{categoryStyle.label}</span>
      </td>

      <ReadCell value={row.plan} />

      <td className="cell-fee">
        <span className="cell-fee__main">{feeParts.primary}</span>
        {feeParts.approx && <span className="cell-fee__approx">{feeParts.approx}</span>}
      </td>

      <ReadCell value={row.usage} className="cell-note" empty="blank" />

      <td>
        {!row.subscribed ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={handleToggle}
            title={t.subscribeTitle}
          >
            {t.subscribe}
          </button>
        ) : row.expired && !row.dueDate ? (
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
        ) : !row.dueDate ? (
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
            <span className={`due-badge ${dueBadgeClass}`} title={row.dueDate}>
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
      <table>
        <thead>
          <tr className="list-header">
            <th className="list-header__cell">{t.category}</th>
            <th className="list-header__cell">{t.plan}</th>
            <th className="list-header__cell">{t.fee}</th>
            <th className="list-header__cell">{t.note}</th>
            <th className="list-header__cell">{t.remain}</th>
            <th className="list-header__cell" aria-label={t.actions} />
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
              categoryLabels={dict.form.categoryOptions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});

export function confirmUnrenewedOrDelete(
  plan: string,
  onDelete: () => void,
  onUnsubscribe: () => void,
  language?: AppState["language"]
) {
  if (confirm(tFor(resolveLang(language)).table.unrenewedPrompt(plan))) {
    onDelete();
  } else {
    onUnsubscribe();
  }
}
