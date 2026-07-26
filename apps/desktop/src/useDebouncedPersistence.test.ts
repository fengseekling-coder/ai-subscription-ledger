import { loadFromJson, type AppState } from "@ai-sub/core";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERSIST_DEBOUNCE_MS, useDebouncedPersistence } from "./useDebouncedPersistence";

// 显式标注入参类型，好让 mock.calls[0][0] 有类型、断言里能直接读 budget。
const persistAppState = vi.fn(async (_state: AppState) => {});
vi.mock("./storage", () => ({
  persistAppState: (state: AppState) => persistAppState(state),
  loadAppState: vi.fn(),
}));

function ledger(budget: number): AppState {
  return loadFromJson({ budget, rows: [], bills: [] });
}

/** 推进防抖时钟并让挂起的 promise 落地。 */
async function advance(ms = PERSIST_DEBOUNCE_MS) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

describe("useDebouncedPersistence", () => {
  /**
   * 回归：首个非空 state 来自 loadAppState()，不是用户改动。若把它也写回磁盘，
   * 一旦读取降级成空账本（数据文件损坏后被归档），这次写回就会把空状态落盘，
   * 让降级变成不可逆。
   */
  it("不把刚读出来的初始 state 写回磁盘", async () => {
    renderHook(({ state }: { state: AppState | null }) => useDebouncedPersistence(state), {
      initialProps: { state: ledger(500) as AppState | null },
    });
    await advance();
    expect(persistAppState).not.toHaveBeenCalled();
  });

  it("state 为 null 期间不写盘", async () => {
    renderHook(() => useDebouncedPersistence(null));
    await advance();
    expect(persistAppState).not.toHaveBeenCalled();
  });

  it("初始 state 之后的改动会在防抖结束后落盘", async () => {
    const { rerender } = renderHook(
      ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
      { initialProps: { state: ledger(500) as AppState | null } }
    );
    await advance();

    rerender({ state: ledger(800) });
    expect(persistAppState).not.toHaveBeenCalled(); // 还在防抖窗口内
    await advance();
    expect(persistAppState).toHaveBeenCalledTimes(1);
    expect(persistAppState.mock.calls[0][0]).toMatchObject({ budget: 800 });
  });

  it("连续多次改动只落盘一次，且写的是最后一次的值", async () => {
    const { rerender } = renderHook(
      ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
      { initialProps: { state: ledger(500) as AppState | null } }
    );
    await advance();

    for (const b of [600, 700, 800, 900]) {
      rerender({ state: ledger(b) });
      await act(async () => {
        vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS / 2);
      });
    }
    await advance();

    expect(persistAppState).toHaveBeenCalledTimes(1);
    expect(persistAppState.mock.calls[0][0]).toMatchObject({ budget: 900 });
  });

  describe("flushIfDirty", () => {
    it("有未落盘改动时立即写盘", async () => {
      const { result, rerender } = renderHook(
        ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
        { initialProps: { state: ledger(500) as AppState | null } }
      );
      await advance();

      rerender({ state: ledger(800) });
      await act(async () => {
        await result.current.flushIfDirty();
      });
      expect(persistAppState).toHaveBeenCalledTimes(1);
      expect(persistAppState.mock.calls[0][0]).toMatchObject({ budget: 800 });
    });

    /** 这条是「不可逆降级」的核心防线：没有改动时任何 flush 路径都不许写盘。 */
    it("没有改动时是空操作", async () => {
      const { result } = renderHook(
        ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
        { initialProps: { state: ledger(500) as AppState | null } }
      );
      await advance();

      await act(async () => {
        await result.current.flushIfDirty();
        await result.current.flushIfDirty();
      });
      expect(persistAppState).not.toHaveBeenCalled();
    });

    it("落盘后再次 flush 不会重复写", async () => {
      const { result, rerender } = renderHook(
        ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
        { initialProps: { state: ledger(500) as AppState | null } }
      );
      await advance();

      rerender({ state: ledger(800) });
      await advance();
      expect(persistAppState).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.flushIfDirty();
      });
      expect(persistAppState).toHaveBeenCalledTimes(1);
    });

    it("落盘失败后仍视为有改动，下次 flush 会重试", async () => {
      persistAppState.mockRejectedValueOnce(new Error("disk full"));
      const { result, rerender } = renderHook(
        ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
        { initialProps: { state: ledger(500) as AppState | null } }
      );
      await advance();

      rerender({ state: ledger(800) });
      await act(async () => {
        await result.current.flushIfDirty();
      });
      expect(persistAppState).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.flushIfDirty();
      });
      expect(persistAppState).toHaveBeenCalledTimes(2);
    });
  });

  describe("补写路径", () => {
    it("窗口隐藏时补写未落盘的改动", async () => {
      const { rerender } = renderHook(
        ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
        { initialProps: { state: ledger(500) as AppState | null } }
      );
      await advance();

      rerender({ state: ledger(800) });
      await act(async () => {
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
        await Promise.resolve();
      });
      expect(persistAppState).toHaveBeenCalledTimes(1);
    });

    it("窗口隐藏但无改动时不写盘", async () => {
      renderHook(({ state }: { state: AppState | null }) => useDebouncedPersistence(state), {
        initialProps: { state: ledger(500) as AppState | null },
      });
      await advance();

      await act(async () => {
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
        await Promise.resolve();
      });
      expect(persistAppState).not.toHaveBeenCalled();
    });

    it("卸载时补写未落盘的改动", async () => {
      const { rerender, unmount } = renderHook(
        ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
        { initialProps: { state: ledger(500) as AppState | null } }
      );
      await advance();

      rerender({ state: ledger(800) });
      await act(async () => {
        unmount();
        await Promise.resolve();
      });
      expect(persistAppState).toHaveBeenCalledTimes(1);
      expect(persistAppState.mock.calls[0][0]).toMatchObject({ budget: 800 });
    });

    it("卸载时无改动则不写盘", async () => {
      const { unmount } = renderHook(
        ({ state }: { state: AppState | null }) => useDebouncedPersistence(state),
        { initialProps: { state: ledger(500) as AppState | null } }
      );
      await advance();

      await act(async () => {
        unmount();
        await Promise.resolve();
      });
      expect(persistAppState).not.toHaveBeenCalled();
    });
  });
});
