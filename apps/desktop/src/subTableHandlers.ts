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
import { resolveLang, tFor } from "./i18n";
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
  const t = tFor(resolveLang(state.language)).table;
  const renewNotice = options?.renewNotice !== false;

  /** 执行动作并处理错误与提交。 */
  const runAction = <T>(action: () => T | { error: string }, onResult: (result: T) => void) => {
    const result = action();
    if ("error" in result) {
      showNotice(result.error, true);
      return;
    }
    commit(result);
    onResult(result as T);
  };

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
      runAction(() => renewRow(state, i), (result) => {
        if (renewNotice) {
          showNotice(t.renewedNotice(result.rows[i].plan, result.rows[i].dueDate));
        }
      });
    },
    onMarkUnrenewed: (i) => {
      const row = state.rows[i];
      confirmUnrenewedOrDelete(
        row.plan,
        () => {
          runAction(() => deleteRow(state, i), () => {
            showNotice(t.deletedNotice(row.plan));
          });
        },
        () => {
          runAction(() => markUnrenewed(state, i, "unsubscribe"), (_result) => {
            showNotice(t.unsubscribedNotice(row.plan));
          });
        },
        state.language
      );
    },
    onMarkExpired: (i) => {
      runAction(() => markExpired(state, i), () => {});
    },
    onClearExpired: (i) => {
      runAction(() => clearExpired(state, i), () => {});
    },
    onDelete: (i) => {
      if (confirm(t.confirmDeleteRow)) {
        runAction(() => deleteRow(state, i), () => {});
      }
    },
  };
}