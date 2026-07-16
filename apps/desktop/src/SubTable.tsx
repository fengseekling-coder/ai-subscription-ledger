import { memo, useCallback, useMemo } from "react";
import {
  dueMeta,
  isCreditLike,
  statusDisplayClass,
  statusTitle,
  type SubscriptionRow,
} from "@ai-sub/core";

const ReadCell = memo(function ReadCell({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <td className={className ?? ""}>
      {value || <span className="text-tertiary">—</span>}
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

// Category display mapping
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
  const categoryStyle = getCategoryStyle(row.category);

  // Memoized callbacks for this row
  const handleToggle = useCallback(() => onToggle(index), [onToggle, index]);
  const handleEdit = useCallback(() => onEdit(index), [onEdit, index]);
  const handlePickDue = useCallback(() => onPickDue(index), [onPickDue, index]);
  const handleRenew = useCallback(() => onRenew(index), [onRenew, index]);
  const handleMarkUnrenewed = useCallback(() => onMarkUnrenewed(index), [onMarkUnrenewed, index]);
  const handleMarkExpired = useCallback(() => onMarkExpired(index), [onMarkExpired, index]);
  const handleClearExpired = useCallback(() => onClearExpired(index), [onClearExpired, index]);
  const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);

  const statusClass = useMemo(() => statusDisplayClass(row), [row]);
  const statusTooltip = useMemo(() => statusTitle(row), [row]);

  // Determine due badge style
  const dueBadgeClass =
    due.cls === "overdue"
      ? "due-badge--overdue"
      : due.cls === "soon"
        ? "due-badge--warn"
        : "due-badge--ok";

  // Row opacity based on state
  const rowOpacity = row.expired ? "list-item--expired" : !row.subscribed ? "list-item--unsubscribed" : "";

  return (
    <tr className={`list-item ${rowOpacity}`}>
      {/* 分类 */}
      <td>
        <span className={`category-tag ${categoryStyle.class}`}>
          {categoryStyle.label}
        </span>
      </td>

      {/* 套餐/额度 */}
      <ReadCell value={row.plan} />

      {/* 月费 */}
      <td style={{ fontWeight: 500 }}>{row.fee || "—"}</td>

      {/* 订阅状态 */}
      <td style={{ textAlign: "center" }}>
        {row.subscribed ? (
          <button
            type="button"
            className={`status-dot ${statusClass}`}
            title={statusTooltip}
            aria-label="已订阅"
            onClick={handleToggle}
          />
        ) : (
          <button
            type="button"
            className="status-dot status-dot--unsubscribed"
            title="点击标记为已订阅"
            aria-label="未订阅"
            onClick={handleToggle}
          />
        )}
      </td>

      {/* 备注 */}
      <ReadCell value={row.usage} />

      {/* 订阅日期 */}
      <td>
        {!row.subscribed ? (
          <span className="text-tertiary">—</span>
        ) : row.expired && !row.dueDate ? (
          <span className="due-badge due-badge--overdue">已过期</span>
        ) : isCreditLike(row) ? (
          <span className="category-tag category-tag--credit" style={{ fontSize: 11 }}>
            非周期
          </span>
        ) : !row.dueDate ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={handlePickDue}
            style={{ padding: "4px 8px", fontSize: 12 }}
          >
            设置日期
          </button>
        ) : (
          <span>{row.dueDate}</span>
        )}
      </td>

      {/* 剩余时间 */}
      <td>
        {!row.subscribed ? (
          <span className="text-tertiary">—</span>
        ) : row.expired && !row.dueDate ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`due-badge ${dueBadgeClass}`}>已过期</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" className="btn btn--sm" onClick={handleClearExpired}>
                恢复
              </button>
              <button type="button" className="btn btn--sm btn--danger" onClick={handleDelete}>
                删除
              </button>
            </div>
          </div>
        ) : isCreditLike(row) ? (
          <span className="text-tertiary">—</span>
        ) : !row.dueDate ? (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={handleMarkExpired}
          >
            标记过期
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`due-badge ${dueBadgeClass}`}>{due.label}</span>
            {due.cls === "overdue" && (
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" className="btn btn--sm" onClick={handleRenew}>
                  已续费
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={handleMarkUnrenewed}
                >
                  取消
                </button>
              </div>
            )}
          </div>
        )}
      </td>

      {/* 操作 */}
      <td>
        <button type="button" className="btn btn--sm btn--ghost" onClick={handleEdit}>
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

  // Memoize stable handler references
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
        <div className="empty-state__desc">点击右上角「+」添加你的第一个订阅</div>
      </div>
    );
  }

  return (
    <div className="list-container">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr className="list-header">
            <th className="list-header__cell">分类</th>
            <th className="list-header__cell">套餐</th>
            <th className="list-header__cell">月费</th>
            <th className="list-header__cell" style={{ textAlign: "center" }}>
              状态
            </th>
            <th className="list-header__cell">备注</th>
            <th className="list-header__cell">订阅日</th>
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

/** Shared confirm + actions for unrenewed / delete row (used by App views). */
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
