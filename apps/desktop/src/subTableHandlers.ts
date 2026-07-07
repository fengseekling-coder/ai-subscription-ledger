import {
  clearExpired,
  deleteRow,
  markExpired,
  markUnrenewed,
  renewRow,
  subscribeNoticeAfterToggle,
  toggleSubscribe,
  type AppState,
} from "@ai-sub/core";
import type { SubTableHandlers } from "./SubTable";
import { confirmUnrenewedOrDelete } from "./SubTable";

export function buildSubTableHandlers(
  state: AppState,
  commit: (next: AppState) => void,
  showNotice: (text: string, danger?: boolean) => void,
  setEditIndex: (i: number) => void,
  setDuePickIndex: (i: number) => void,
  options?: { renewNotice?: boolean }
): SubTableHandlers {
  const renewNotice = options?.renewNotice !== false;
  return {
    onToggle: (i) => {
      const next = toggleSubscribe(state, i);
      commit(next);
      const msg = subscribeNoticeAfterToggle(next, i);
      if (msg) showNotice(msg);
    },
    onEdit: setEditIndex,
    onPickDue: setDuePickIndex,
    onRenew: (i) => {
      const next = renewRow(state, i);
      commit(next);
      if (renewNotice) {
        showNotice(`${state.rows[i].plan} 已续费，续费日 → ${next.rows[i].dueDate}`);
      }
    },
    onMarkUnrenewed: (i) => {
      const row = state.rows[i];
      confirmUnrenewedOrDelete(
        row.plan,
        () => {
          commit(deleteRow(state, i));
          showNotice(`${row.plan} 已删除。`);
        },
        () => {
          commit(markUnrenewed(state, i, "unsubscribe"));
          showNotice(`${row.plan} 已改为未订阅。`);
        }
      );
    },
    onMarkExpired: (i) => commit(markExpired(state, i)),
    onClearExpired: (i) => commit(clearExpired(state, i)),
    onDelete: (i) => {
      if (confirm("确定删除这一行？")) commit(deleteRow(state, i));
    },
  };
}