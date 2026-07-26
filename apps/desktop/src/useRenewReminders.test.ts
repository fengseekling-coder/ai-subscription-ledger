import { loadFromJson, type AppState } from "@ai-sub/core";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRenewReminders } from "./useRenewReminders";

const sendNotification = vi.fn();
const isPermissionGranted = vi.fn(async () => true);
const requestPermission = vi.fn(async () => "granted");

vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
  isPermissionGranted: () => isPermissionGranted(),
  requestPermission: () => requestPermission(),
}));

/** 带一个 2 天后到期的订阅 —— 落在 3 天提醒窗口内。 */
function stateWithPending(overrides: Partial<AppState> = {}): AppState {
  const due = new Date();
  due.setDate(due.getDate() + 2);
  const iso = due.toISOString().slice(0, 10);
  return {
    ...loadFromJson({
      budget: 500,
      rows: [
        {
          id: "r1",
          category: "官方",
          plan: "Claude Pro",
          fee: "US$20",
          subscribed: true,
          dueDate: iso,
          usage: "",
          subscribedAt: "2026-01-01",
          expired: false,
        },
      ],
      bills: [],
    }),
    ...overrides,
  };
}

/** 等一轮微任务，让 checkReminders 里的 await 链跑完。 */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("useRenewReminders", () => {
  it("账本就绪后检查一次并推送通知", async () => {
    const showNotice = vi.fn();
    renderHook(() => useRenewReminders(stateWithPending(), true, showNotice));
    await settle();
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0]).toMatchObject({ title: "订阅续费提醒" });
  });

  it("state 从 null 变为账本时才检查，null 阶段不推送", async () => {
    const showNotice = vi.fn();
    const { rerender } = renderHook(
      ({ state }: { state: AppState | null }) => useRenewReminders(state, true, showNotice),
      { initialProps: { state: null as AppState | null } }
    );
    await settle();
    expect(sendNotification).not.toHaveBeenCalled();

    rerender({ state: stateWithPending() });
    await settle();
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  /**
   * 回归：提醒 effect 曾把 state 列进依赖，于是任何一次 setState —— 包括只改外观
   * 或语言 —— 都会重跑 effect 并立刻推一条系统通知。
   */
  it("与续费无关的状态变更不会重复推送", async () => {
    const showNotice = vi.fn();
    const base = stateWithPending();
    const { rerender } = renderHook(
      ({ state }: { state: AppState }) => useRenewReminders(state, true, showNotice),
      { initialProps: { state: base } }
    );
    await settle();
    expect(sendNotification).toHaveBeenCalledTimes(1);

    // 切主题色、切主题模式、切语言、改预算：四次真实的 setState，都与续费无关
    rerender({ state: { ...base, appearance: { ...base.appearance, accent: "blue" } } });
    await settle();
    rerender({ state: { ...base, appearance: { ...base.appearance, mode: "dark" } } });
    await settle();
    rerender({ state: { ...base, language: "en" } });
    await settle();
    rerender({ state: { ...base, budget: 900 } });
    await settle();

    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("编辑订阅本身也不会额外推送（推送只由定时器或手动触发）", async () => {
    const showNotice = vi.fn();
    const base = stateWithPending();
    const { rerender } = renderHook(
      ({ state }: { state: AppState }) => useRenewReminders(state, true, showNotice),
      { initialProps: { state: base } }
    );
    await settle();

    rerender({
      state: { ...base, rows: [{ ...base.rows[0], usage: "改了备注" }] },
    });
    await settle();

    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("notifyOn 关闭时不推送系统通知", async () => {
    const showNotice = vi.fn();
    renderHook(() => useRenewReminders(stateWithPending(), false, showNotice));
    await settle();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("没有 3 天内待续费时不推送", async () => {
    const showNotice = vi.fn();
    const far = new Date();
    far.setDate(far.getDate() + 60);
    const state = stateWithPending();
    const noPending: AppState = {
      ...state,
      rows: [{ ...state.rows[0], dueDate: far.toISOString().slice(0, 10) }],
    };
    renderHook(() => useRenewReminders(noPending, true, showNotice));
    await settle();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  describe("toggleNotify", () => {
    it("开启时写入偏好并立即做一次强制检查", async () => {
      const showNotice = vi.fn();
      const setNotifyOn = vi.fn();
      const { result } = renderHook(() =>
        useRenewReminders(stateWithPending(), false, showNotice)
      );
      await settle();

      await act(async () => {
        await result.current.toggleNotify(true, setNotifyOn);
      });

      expect(localStorage.getItem("ai-sub-notify")).toBe("on");
      expect(setNotifyOn).toHaveBeenCalledWith(true);
      // force=true：即使 notifyOn 传的是 false 也会推送，并在应用内给出提示
      expect(sendNotification).toHaveBeenCalledTimes(1);
      expect(showNotice.mock.calls.some(([text]) => String(text).includes("续费提醒："))).toBe(true);
    });

    it("未授权通知时不写入偏好", async () => {
      isPermissionGranted.mockResolvedValueOnce(false);
      requestPermission.mockResolvedValueOnce("denied");
      const showNotice = vi.fn();
      const setNotifyOn = vi.fn();
      const { result } = renderHook(() =>
        useRenewReminders(stateWithPending(), false, showNotice)
      );
      await settle();

      await act(async () => {
        await result.current.toggleNotify(true, setNotifyOn);
      });

      expect(localStorage.getItem("ai-sub-notify")).toBeNull();
      expect(setNotifyOn).not.toHaveBeenCalled();
    });

    it("关闭时写入偏好", async () => {
      const showNotice = vi.fn();
      const setNotifyOn = vi.fn();
      const { result } = renderHook(() =>
        useRenewReminders(stateWithPending(), true, showNotice)
      );
      await settle();

      await act(async () => {
        await result.current.toggleNotify(false, setNotifyOn);
      });

      expect(localStorage.getItem("ai-sub-notify")).toBe("off");
      expect(setNotifyOn).toHaveBeenCalledWith(false);
    });

    it("强制检查在没有待续费时给出「无待续费」提示", async () => {
      const showNotice = vi.fn();
      const state = stateWithPending();
      const noPending: AppState = {
        ...state,
        rows: [{ ...state.rows[0], subscribed: false, dueDate: "" }],
      };
      const { result } = renderHook(() => useRenewReminders(noPending, false, showNotice));
      await settle();

      await act(async () => {
        await result.current.toggleNotify(true, vi.fn());
      });

      expect(showNotice.mock.calls.some(([t]) => String(t).includes("没有 3 天内"))).toBe(true);
      expect(sendNotification).not.toHaveBeenCalled();
    });
  });
});
