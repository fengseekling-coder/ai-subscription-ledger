import { pendingRenewItems, type AppState } from "@ai-sub/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { useCallback, useEffect, useRef } from "react";

export function useRenewReminders(
  state: AppState | null,
  notifyOn: boolean,
  showNotice: (text: string, danger?: boolean) => void
) {
  const stateRef = useRef(state);
  // Keep stateRef in sync to avoid stale closure in checkReminders
  stateRef.current = state;

  const checkReminders = useCallback(
    async (force: boolean) => {
      const currentState = stateRef.current;
      if (!currentState) return;
      const items = pendingRenewItems(currentState.rows);
      if (!items.length) {
        if (force) showNotice("当前没有 3 天内需要续费的已订阅套餐。");
        return;
      }
      const msg = items.map((x) => `${x.row.plan}（${x.row.dueDate}，剩 ${x.left} 天）`).join("；");
      if (force) showNotice("续费提醒：" + msg, true);
      if (force || notifyOn) {
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        if (granted) {
          await sendNotification({ title: "订阅续费提醒", body: msg });
        }
      }
    },
    [notifyOn, showNotice]
  );

  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => void checkReminders(false), 60 * 60 * 1000);
    void checkReminders(false);
    return () => clearInterval(t);
  }, [state, checkReminders]);

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