import { memo, useCallback, useMemo } from "react";
import {
  dueMeta,
  feeDisplayParts,
  isCreditLike,
  type SubscriptionRow,
} from "@ai-sub/core";

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
};

const getCategoryStyle = (category: string): { class: string; label: string } => {
  switch (category) {
    case "官方":
      return { class: "category-tag--official", label: "官方" };
    case "中转":
      return { class: "category-tag--relay", label: "中转" };
    case "中转额度包":
      return { class: "category-tag--credit", label: "额度" };
    default:
      return { class: "category-tag--other", label: category };
  }
};

const SubTableRow = memo(function SubTableRow({ row, index, handlers }: SubTableRowProps) {
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

  const due = useMemo(() => dueMeta(row.dueDate), [row.dueDate]);
  const feeParts = useMemo(() => feeDisplayParts(row.fee), [row.fee]);
  const categoryStyle = getCategoryStyle(row.category);

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
            title="标记为已订阅"
          >
            订阅
          </button>
        ) : row.expired && !row.dueDate ? (
          <div className="due-actions">
            <span className={`due-badge ${dueBadgeClass}`}>已过期</span>
            <div className="due-actions__btns">
              <button type="button" className="btn btn--sm" onClick={handleClearExpired}>
                恢复
              </button>
              <button type="button" className="btn btn--sm btn--danger" onClick={handleDelete}>
                删除
              </button>
            </div>
          </div>
        ) : isCreditLike(row) ? (
          <span className="text-tertiary">非周期</span>
        ) : !row.dueDate ? (
          <div className="due-actions">
            <button type="button" className="btn btn--sm btn--ghost" onClick={handlePickDue}>
              设置日期
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={handleMarkExpired}>
              过期
            </button>
          </div>
        ) : (
          <div className="due-actions">
            <span className={`due-badge ${dueBadgeClass}`} title={row.dueDate}>
              {due.label}
            </span>
            {due.cls === "overdue" && (
              <div className="due-actions__btns">
                <button type="button" className="btn btn--sm" onClick={handleRenew}>
                  已续费
                </button>
                <button type="button" className="btn btn--sm btn--ghost" onClick={handleMarkUnrenewed}>
                  取消
                </button>
              </div>
            )}
          </div>
        )}
      </td>

      <td className="cell-actions">
        <button type="button" className="btn btn--sm btn--ghost cell-actions__btn" onClick={handleEdit}>
          编辑
        </button>
      </td>
    </tr>
  );
});

export const SubTable = memo(function SubTable({
  entries,
  ...handlers
}: {
  entries: { row: SubscriptionRow; index: number }[];
} & SubTableHandlers) {
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
        <div className="empty-state__title">暂无订阅</div>
        <div className="empty-state__desc">点右上角新增，或从服务库添加</div>
      </div>
    );
  }

  return (
    <div className="list-container">
      <table>
        <thead>
          <tr className="list-header">
            <th className="list-header__cell">分类</th>
            <th className="list-header__cell">套餐</th>
            <th className="list-header__cell">金额</th>
            <th className="list-header__cell">备注</th>
            <th className="list-header__cell">剩余</th>
            <th className="list-header__cell" aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {entries.map(({ row, index }) => (
            <SubTableRow key={row.id} row={row} index={index} handlers={stableHandlers} />
          ))}
        </tbody>
      </table>
    </div>
  );
});

export function confirmUnrenewedOrDelete(
  plan: string,
  onDelete: () => void,
  onUnsubscribe: () => void
) {
  if (
    confirm(
      `${plan} 未续费：删除条目，还是改为未订阅？\n确定 = 删除，取消 = 改为未订阅`
    )
  ) {
    onDelete();
  } else {
    onUnsubscribe();
  }
}
