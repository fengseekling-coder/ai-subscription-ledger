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
      if ("error" in next) {
        showNotice(next.error, true);
        return;
      }
      commit(next);
      const msg = subscribeNoticeAfterToggle(next, i);
      if (msg) showNotice(msg);
    },
    onEdit: setEditIndex,
    onPickDue: setDuePickIndex,
    onRenew: (i) => {
      const next = renewRow(state, i);
      if ("error" in next) {
        showNotice(next.error, true);
        return;
      }
      commit(next);
      if (renewNotice) {
        showNotice(`${next.rows[i].plan} 已续费，续费日 → ${next.rows[i].dueDate}`);
      }
    },
    onMarkUnrenewed: (i) => {
      const row = state.rows[i];
      confirmUnrenewedOrDelete(
        row.plan,
        () => {
          const result = deleteRow(state, i);
          if ("error" in result) {
            showNotice(result.error, true);
            return;
          }
          commit(result);
          showNotice(`${row.plan} 已删除。`);
        },
        () => {
          const result = markUnrenewed(state, i, "unsubscribe");
          if ("error" in result) {
            showNotice(result.error, true);
            return;
          }
          commit(result);
          showNotice(`${row.plan} 已改为未订阅。`);
        }
      );
    },
    onMarkExpired: (i) => {
      const result = markExpired(state, i);
      if ("error" in result) {
        showNotice(result.error, true);
        return;
      }
      commit(result);
    },
    onClearExpired: (i) => {
      const result = clearExpired(state, i);
      if ("error" in result) {
        showNotice(result.error, true);
        return;
      }
      commit(result);
    },
    onDelete: (i) => {
      if (confirm("确定删除这一行？")) {
        const result = deleteRow(state, i);
        if ("error" in result) {
          showNotice(result.error, true);
          return;
        }
        commit(result);
      }
    },
  };
}