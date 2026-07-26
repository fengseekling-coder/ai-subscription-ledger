import type { AppState } from "@ai-sub/core";
import { useCallback, useEffect, useRef } from "react";
import { persistAppState } from "./storage";

/** 防抖落盘间隔（ms）。改动后等这么久没有新改动才写盘。 */
export const PERSIST_DEBOUNCE_MS = 200;

/**
 * 防抖落盘 + 隐藏/卸载/关窗时补写。
 *
 * 两条不变量：
 * 1. **只在真正有改动时写盘**。所有 flush 路径都查 dirty，否则「刚从磁盘读出来的
 *    状态」会被原样写回；万一读取降级成了空账本（数据文件损坏后被归档），这次
 *    写回就会把空状态落盘，让降级变成不可逆。
 * 2. **首个非空 state 不写盘**。它来自 loadAppState()，不是用户改动。
 */
export function useDebouncedPersistence(state: AppState | null) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const dirty = useRef(false);
  const seenInitialState = useRef(false);

  // 在 effect 里同步而非渲染期赋值：渲染期写 ref 是 React 明确不建议的。
  // flushIfDirty 只在事件回调/effect 清理里读它，那时本 effect 早已跑过。
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const flushIfDirty = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirty.current) return;
    const current = stateRef.current;
    if (!current) return;
    dirty.current = false;
    try {
      await persistAppState(current);
    } catch {
      dirty.current = true;
    }
  }, []);

  useEffect(() => {
    if (!state) return;
    if (!seenInitialState.current) {
      seenInitialState.current = true;
      return;
    }

    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      dirty.current = false;
      persistAppState(state).catch(() => {
        dirty.current = true;
      });
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [state]);

  // 窗口隐藏或页面即将卸载时立刻补写：否则强杀 / 系统睡眠 / 立即关窗
  // 落在防抖窗口内会丢掉最后一次编辑。
  useEffect(() => {
    const onFlush = () => {
      void flushIfDirty();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onFlush();
    };
    window.addEventListener("beforeunload", onFlush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onFlush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushIfDirty]);

  useEffect(() => {
    return () => {
      void flushIfDirty();
    };
  }, [flushIfDirty]);

  return { stateRef, flushIfDirty };
}
