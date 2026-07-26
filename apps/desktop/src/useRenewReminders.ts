import { pendingRenewItems, type AppState } from "@ai-sub/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { useCallback, useEffect, useRef } from "react";

export function useRenewReminders(
  state: AppState | null,
  notifyOn: boolean,
  showNotice: (text: string, danger?: boolean) => void
) {
  // state / notifyOn 走 ref，好让 checkReminders 与下面的定时器 effect 都**不依赖 state**。
  //
  // 曾经把 state 列进依赖，后果是：任何一次 setState（编辑订阅、改预算，甚至只是切
  // 主题色或语言）都会重跑 effect 并立刻 checkReminders(false) —— notifyOn 打开时
  // 就是每改一下推一条系统通知。同时每小时的 interval 被反复 clear/重建，
  // 「每小时检查」实际上永远不会到期。
  const stateRef = useRef<AppState | null>(state);
  const notifyOnRef = useRef(notifyOn);

  // 渲染期写 ref 是 React 明确不建议的，放到 effect 里同步。
  // 读取只发生在事件回调与定时器里，那时本 effect 早已跑过。
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    notifyOnRef.current = notifyOn;
  }, [notifyOn]);

  const checkReminders = useCallback(
    async (force: boolean) => {
      const current = stateRef.current;
      if (!current) return;
      const items = pendingRenewItems(current.rows);
      if (!items.length) {
        if (force) showNotice("当前没有 3 天内需要续费的已订阅套餐。");
        return;
      }
      const msg = items.map((x) => `${x.row.plan}（${x.row.dueDate}，剩 ${x.left} 天）`).join("；");
      if (force) showNotice("续费提醒：" + msg, true);
      if (force || notifyOnRef.current) {
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        if (granted) {
          await sendNotification({ title: "订阅续费提醒", body: msg });
        }
      }
    },
    [showNotice]
  );

  // 只在「账本首次就绪」时检查一次，此后每小时一次。ready 只会 false→true 翻转一次，
  // checkReminders 的依赖只有稳定的 showNotice，所以这个 effect 不会被状态变更重启。
  const ready = state !== null;
  useEffect(() => {
    if (!ready) return;
    void checkReminders(false);
    const t = setInterval(() => void checkReminders(false), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [ready, checkReminders]);

  const toggleNotify = useCallback(
    async (on: boolean, setNotifyOn: (v: boolean) => void) => {
      if (on) {
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        if (!granted) {
          showNotice("未授权通知，仍可在应用内看到提醒。");
          return;
        }
        localStorage.setItem("ai-sub-notify", "on");
        setNotifyOn(true);
        showNotice("已开启续费提醒。打开应用时会检查 3 天内续费。");
        await checkReminders(true);
      } else {
        localStorage.setItem("ai-sub-notify", "off");
        setNotifyOn(false);
        showNotice("已关闭续费提醒。");
      }
    },
    [checkReminders, showNotice]
  );

  return { toggleNotify };
}
