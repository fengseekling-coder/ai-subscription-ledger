import {
  categoryClass,
  dueMeta,
  isCreditLike,
  rowClass,
  statusDisplayClass,
  statusTitle,
  type SubscriptionRow,
} from "@ai-sub/core";

function ReadCell({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <td className={className ?? ""}>
      {value || <span className="due-muted">—</span>}
    </td>
  );
}

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

export function SubTable({
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

  return (
    <table>
      <thead>
        <tr>
          <th>分类</th>
          <th>套餐 / 额度</th>
          <th>月费</th>
          <th>订阅</th>
          <th>备注</th>
          <th>订阅日期</th>
          <th>剩余时间</th>
          <th aria-label="操作" />
        </tr>
      </thead>
      <tbody>
        {entries.map(({ row, index }) => {
          const due = dueMeta(row.dueDate);
          return (
            <tr key={row.id} className={rowClass(row)}>
              <td>
                <span className={`category ${categoryClass(row.category)}`}>
                  {row.category}
                </span>
              </td>
              <ReadCell value={row.plan} />
              <ReadCell value={row.fee} />
              <td style={{ textAlign: "center" }}>
                {row.subscribed ? (
                  <button
                    type="button"
                    className={`status-dot ${statusDisplayClass(row)}`}
                    title={statusTitle(row)}
                    aria-label="已订阅"
                    onClick={() => onToggle(index)}
                  />
                ) : (
                  <span className="status-hit" title="点击标记为已订阅" onClick={() => onToggle(index)} />
                )}
              </td>
              <ReadCell value={row.usage} />
              <td>
                {!row.subscribed ? (
                  <span className="due-muted">—</span>
                ) : row.expired && !row.dueDate ? (
                  <span className="badge-expired">已过期</span>
                ) : isCreditLike(row) ? (
                  <span className="tag-cycle">非周期</span>
                ) : !row.dueDate ? (
                  <span className="due-placeholder" onClick={() => onPickDue(index)}>
                    设置日期
                  </span>
                ) : (
                  <span className="date-display">{row.dueDate}</span>
                )}
              </td>
              <td>
                {!row.subscribed ? (
                  <span className="due-muted">—</span>
                ) : row.expired && !row.dueDate ? (
                  <div className="cell-remain">
                    <span className="due-row-actions" style={{ display: "inline-flex" }}>
                      <button type="button" onClick={() => onClearExpired(index)}>
                        恢复
                      </button>
                      <button type="button" onClick={() => onDelete(index)}>
                        删
                      </button>
                    </span>
                  </div>
                ) : isCreditLike(row) ? (
                  <span className="due-muted">—</span>
                ) : !row.dueDate ? (
                  <div className="cell-remain">
                    <span className="due-row-actions" style={{ display: "inline-flex" }}>
                      <button type="button" onClick={() => onMarkExpired(index)}>
                        过期
                      </button>
                    </span>
                  </div>
                ) : (
                  <div className="cell-remain">
                    <span className={`due-badge ${due.cls}`}>{due.label}</span>
                    {due.cls === "overdue" && (
                      <span className="due-row-actions">
                        <button type="button" onClick={() => onRenew(index)}>
                          已续费
                        </button>
                        <button type="button" onClick={() => onMarkUnrenewed(index)}>
                          取消
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </td>
              <td>
                <div className="actions">
                  <button type="button" className="btn-edit" onClick={() => onEdit(index)}>
                    编
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Shared confirm + actions for unrenewed / delete row (used by App views). */
export function confirmUnrenewedOrDelete(
  plan: string,
  onDelete: () => void,
  onUnsubscribe: () => void
) {
  if (confirm(`${plan} 未续费：删除条目，还是改为未订阅？\n确定 = 删除，取消 = 改为未订阅`)) {
    onDelete();
  } else {
    onUnsubscribe();
  }
}