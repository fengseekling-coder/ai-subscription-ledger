import {
  billDraftFor,
  billToDraft,
  billsForCalendarMonth,
  computeSummary,
  expiredRowEntries,
  fmtMoney,
  pendingRenewItems,
  pickDueDate,
  sortedBills,
  visibleRowEntries,
  type AppState,
  type BillDraft,
} from "@ai-sub/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BillFormModal } from "./BillFormModal";
import { BillsView } from "./BillsView";
import { Dashboard } from "./Dashboard";
import { DueDatePickerModal } from "./DueDatePickerModal";
import { MonitorModal } from "./MonitorModal";
import { PendingView } from "./PendingView";
import { SettingsModal } from "./SettingsModal";
import { resolveLang, tFor, type Dict, type LangPref } from "./i18n";
import { applyAppearance, type Appearance } from "./theme";
import { StatsView } from "./StatsView";
import { SubTable } from "./SubTable";
import { buildSubTableHandlers } from "./subTableHandlers";
import { SubscriptionFormModal, type SubscriptionFormDraft } from "./SubscriptionFormModal";
import { loadAppState } from "./storage";
import { useDebouncedPersistence } from "./useDebouncedPersistence";
import { useRenewReminders } from "./useRenewReminders";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Icon } from "./ui/Icon";

type AppMode = "subs" | "expired" | "bills" | "pending" | "stats";

const NEW_SUBSCRIPTION_DRAFT: SubscriptionFormDraft = {
  category: "AI 服务",
  purchaseChannel: "官方",
  billingModel: "月付",
  plan: "",
  fee: "",
  subscribedAt: "",
  dueDate: "",
  usage: "",
  subscribed: false,
  expired: false,
};

// Custom hook for tray menu updates
function useTrayMenu(
  state: AppState | null,
  summary: ReturnType<typeof computeSummary> | null,
  t: Dict["app"]
) {
  const trayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state || !summary) return;
    
    const nearest =
      summary.nearestPlan && summary.nearestDueDate
        ? t.trayNext(summary.nearestPlan, summary.nearestDueDate)
        : t.trayNextNone;

    if (trayTimer.current) clearTimeout(trayTimer.current);
    trayTimer.current = setTimeout(() => {
      void invoke("update_tray_menu", {
        pendingCount: summary.pendingRenewCount,
        nearestLabel: nearest.slice(0, 80),
      }).catch(() => {});
    }, 800);

    return () => {
      if (trayTimer.current) {
        clearTimeout(trayTimer.current);
        trayTimer.current = null;
      }
    };
  }, [state, summary, t]);
}

// Custom hook for window close handling
function useWindowCloseHandler(flushIfDirty: () => Promise<void>) {
  useEffect(() => {
    // 纯浏览器环境（vite dev 预览）没有 Tauri 窗口
    if (!("__TAURI_INTERNALS__" in window)) return;
    const w = getCurrentWindow();
    const unlisten = w.onCloseRequested(async (e) => {
      e.preventDefault();
      // 走同一个 flush：有改动才落盘，没改动就直接关，不把读出来的状态写回去。
      await flushIfDirty();
      await w.destroy();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [flushIfDirty]);
}

// Navigation handler hook
function useNavigation(handler: (mode: AppMode) => void) {
  useEffect(() => {
    const unlisten = listen<string>("navigate", (e) => {
      if (e.payload === "pending") handler("pending");
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [handler]);
}

// Notice hook
function useNotice() {
  const [notice, setNotice] = useState<{ text: string; danger?: boolean } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((text: string, danger = false) => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    setNotice({ text, danger });
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimer.current = null;
    }, danger ? 5000 : 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  return { notice, showNotice };
}

export default function App() {
  // Core state
  const [state, setState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state
  const [mode, setMode] = useState<AppMode>("subs");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [duePickIndex, setDuePickIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);
  const [notifyOn, setNotifyOn] = useState(localStorage.getItem("ai-sub-notify") === "on");
  // 账单表单：新增时 billId 为 null，编辑时带上要改的账单 id
  const [billForm, setBillForm] = useState<{ billId: string | null; draft: BillDraft } | null>(null);
  
  // Hooks
  const { notice, showNotice } = useNotice();
  const { flushIfDirty } = useDebouncedPersistence(state);
  useWindowCloseHandler(flushIfDirty);

  // Derived state - memoized
  const lang = resolveLang(state?.language);
  const tr = useMemo(() => tFor(lang), [lang]);
  const summary = useMemo(() => (state ? computeSummary(state) : null), [state]);
  const pending = useMemo(() => (state ? pendingRenewItems(state.rows) : []), [state]);
  const bills = useMemo(() => (state ? sortedBills(state) : []), [state]);
  
  const subsEntries = useMemo(
    () => (state ? visibleRowEntries(state) : []),
    [state]
  );

  const expiredEntries = useMemo(
    () => (state ? expiredRowEntries(state) : []),
    [state]
  );
  
  const isEmptyLedger = useMemo(
    () => Boolean(state && state.rows.length === 0 && state.bills.length === 0),
    [state]
  );

  // Load data。isLoading 的初值已经是 true，且 showNotice 是稳定引用（useCallback([])），
  // 本 effect 只在挂载时跑一次，所以不需要再 setIsLoading(true)。
  useEffect(() => {
    let cancelled = false;
    loadAppState()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch((e) => {
        if (!cancelled) {
          setState(null);
          // 用系统语言而不是 tr：此刻账本还没读出来，用户的语言偏好就存在里面，
          // 无从得知。把 tr 列进依赖还会让语言一变就重新加载一次数据。
          const boot = tFor(resolveLang(undefined)).app;
          showNotice(e instanceof Error ? e.message : boot.loadFailed, true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showNotice]);

  // Effects
  useTrayMenu(state, summary, tr.app);
  useNavigation(setMode);
  const { toggleNotify } = useRenewReminders(state, notifyOn, showNotice);

  // Listen for background monitor check results
  useEffect(() => {
    const unlisten = listen("monitor-updated", () => {
      loadAppState()
        .then((s) => setState(s))
        .catch(() => {});
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Auto-switch from pending if empty.
  // 这里刻意保留 effect + setState：改成渲染期派生（mode 为 pending 且列表空时显示 subs）
  // 会让待续费重新出现时视图自己跳回 pending，而现在是留在 subs 不动。行为不同，不顺手改。
  /* eslint-disable react-hooks/set-state-in-effect -- 见上：派生写法会改变可见行为 */
  useEffect(() => {
    if (mode === "pending" && pending.length === 0) setMode("subs");
  }, [mode, pending.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handlers
  const commit = useCallback((next: AppState) => {
    setState(next);
  }, []);

  const changeLanguage = useCallback((next: LangPref) => {
    setState((prev) => (prev ? { ...prev, language: next } : prev));
    // 用目标语言自己的字典报提示，切过去立刻就是新语言的说法
    showNotice(tFor(resolveLang(next)).app.langSwitched);
  }, [showNotice]);

  const changeAppearance = useCallback((next: Appearance) => {
    setState((prev) => (prev ? { ...prev, appearance: { ...prev.appearance, ...next } } : prev));
  }, []);

  // 外观：挂载即应用，偏好变化时实时刷新，并跟随系统主题切换
  useEffect(() => {
    applyAppearance(state?.appearance);
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance(state?.appearance);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [state?.appearance]);

  const subHandlers = useMemo(
    () =>
      state
        ? buildSubTableHandlers(state, commit, showNotice, setEditIndex, setDuePickIndex)
        : null,
    [state, commit, showNotice]
  );

  const expiredSubHandlers = useMemo(
    () =>
      state
        ? buildSubTableHandlers(state, commit, showNotice, setEditIndex, setDuePickIndex, {
            renewNotice: false,
          })
        : null,
    [state, commit, showNotice]
  );

  const closeSubModal = useCallback(() => {
    setEditIndex(null);
    setAddModalOpen(false);
  }, []);

  const openAddSubscription = useCallback(() => {
    setEditIndex(null);
    setAddModalOpen(true);
  }, []);

  const confirmDueDate = useCallback((iso: string) => {
    if (!state || duePickIndex === null) return;
    const r = pickDueDate(state, duePickIndex, iso);
    setDuePickIndex(null);
    if ("error" in r) {
      showNotice(r.error, true);
      return;
    }
    commit(r.state);
  }, [state, duePickIndex, commit, showNotice]);

  const openAddBill = useCallback(() => {
    if (!state) return;
    // 预填第一个在用订阅与其折算金额，但一切都可在弹窗里改再存。
    const draft = billDraftFor(state);
    if ("error" in draft) {
      showNotice(draft.error, true);
      return;
    }
    setBillForm({ billId: null, draft });
  }, [state, showNotice]);

  const openEditBill = useCallback((billId: string) => {
    if (!state) return;
    const bill = state.bills.find((b) => b.id === billId);
    if (!bill) return;
    setBillForm({ billId, draft: billToDraft(bill) });
  }, [state]);

  const handlePrimary = useCallback(() => {
    if (!state) return;
    if (mode === "bills") {
      openAddBill();
      return;
    }
    openAddSubscription();
  }, [state, mode, openAddBill, openAddSubscription]);

  // Modal data
  const editRow = editIndex !== null && state ? state.rows[editIndex] : null;
  const subModalMode: "add" | "edit" | null = addModalOpen
    ? "add"
    : editIndex !== null && editRow
      ? "edit"
      : null;
  const subFormDraft: SubscriptionFormDraft | null =
    subModalMode === "add"
      ? NEW_SUBSCRIPTION_DRAFT
      : subModalMode === "edit" && editRow
        ? {
            category: editRow.category,
            purchaseChannel: editRow.purchaseChannel,
            billingModel: editRow.billingModel,
            plan: editRow.plan,
            fee: editRow.fee,
            subscribedAt: editRow.subscribedAt,
            dueDate: editRow.dueDate,
            usage: editRow.usage,
            subscribed: editRow.subscribed,
            expired: editRow.expired,
          }
        : null;

  // Loading states
  if (isLoading) {
    return (
      <div className="app">
        <div className="loading-screen">…</div>
      </div>
    );
  }

  if (state === null) {
    return (
      <div className="app">
        <div className="loading-screen" style={{ color: "var(--danger)", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <div>{tr.app.loadFailedHint}</div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setIsLoading(true);
              loadAppState()
                .then((s) => setState(s))
                .catch((e) => showNotice(e instanceof Error ? e.message : tr.app.loadFailed, true))
                .finally(() => setIsLoading(false));
            }}
          >
            {tr.app.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="app">
        <div className="loading-screen">{tr.app.loading}</div>
      </div>
    );
  }

  const billMonthTotal = billsForCalendarMonth(state.bills).reduce((s, b) => s + b.amount, 0);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <div className="brand__mark" aria-hidden />
            <div>
              <h1 className="brand__title">{tr.brand}</h1>
            </div>
          </div>
          <div className="toolbar">
            <div className="toolbar__group">
              <button type="button" className="primary" onClick={handlePrimary}>
                {mode === "bills" ? tr.toolbar.addBill : tr.toolbar.add}
              </button>
            </div>
            <div className="toolbar__group">
              <button
                type="button"
                className={notifyOn ? "is-on" : ""}
                onClick={() => void toggleNotify(!notifyOn, setNotifyOn)}
                title={notifyOn ? tr.app.remindersOnTitle : tr.app.remindersOffTitle}
                aria-label={notifyOn ? tr.app.remindersTurnOff : tr.app.remindersTurnOn}
                aria-pressed={notifyOn}
              >
                <Icon name="bell" size={15} />
              </button>
              <button type="button" onClick={() => setShowSettings(true)} title={tr.toolbar.settings} aria-label={tr.toolbar.settings}>
                <Icon name="settings" size={15} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <nav className="seg-nav seg-nav--page" aria-label={tr.app.pagesNav}>
          {(
            [
              ["subs", tr.nav.subs],
              ["stats", tr.nav.stats],
              ["expired", tr.nav.expired],
              ["bills", tr.nav.bills],
            ] as const
          ).map(([m, label]) => (
            <button key={m} type="button" className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
          {pending.length > 0 && (
            <button type="button" className={mode === "pending" ? "active" : ""} onClick={() => setMode("pending")}>
              {tr.nav.pending}
              <span className="seg-badge">{pending.length}</span>
            </button>
          )}
        </nav>

        {!isEmptyLedger && (
          <Dashboard
            state={state}
            summary={summary}
            onCommit={commit}
            variant={mode === "subs" ? "full" : "compact"}
            language={state.language}
          />
        )}

        {notice && (
          <div className={`toast ${notice.danger ? "danger" : ""}`} role="status">
            {notice.text}
          </div>
        )}

        {isEmptyLedger && (
          <div className="empty-ledger">
            <p className="empty-ledger__title">{tr.empty.title}</p>
            <p className="empty-ledger__text">
              {tr.empty.desc}
            </p>
            <div className="empty-ledger__actions">
              <button type="button" className="primary" onClick={openAddSubscription}>
                {tr.empty.add}
              </button>
            </div>
          </div>
        )}

        {(mode !== "subs" || !isEmptyLedger) && (
          <div className="view-toolbar">
            <div className="view-toolbar__left">
              <h3 className="view-toolbar__title">{tr.nav[mode === "subs" ? "subs" : mode === "stats" ? "stats" : mode === "expired" ? "expired" : mode === "bills" ? "bills" : "pending"]}</h3>
              {mode === "subs" && !isEmptyLedger && (
                <span className="section__hint">{summary.activeCount}</span>
              )}
              {mode === "bills" && (
                <span className="section__hint">{fmtMoney(billMonthTotal)}</span>
              )}
              {mode === "pending" && pending.length > 0 && (
                <span className="section__hint">{pending.length}</span>
              )}
            </div>
          </div>
        )}

        {mode === "stats" && <StatsView state={state} />}

        {mode === "subs" && subHandlers && (
          <section className="section">
            <div className="table-card">
              <SubTable entries={subsEntries} language={state.language} {...subHandlers} />
            </div>
          </section>
        )}

        {mode === "expired" && expiredSubHandlers && (
          <section className="section">
            <div className="table-card">
              <SubTable entries={expiredEntries} language={state.language} {...expiredSubHandlers} />
            </div>
          </section>
        )}

        {mode === "bills" && (
          <BillsView
            state={state}
            bills={bills}
            onCommit={commit}
            onNotice={showNotice}
            onEdit={openEditBill}
            language={state.language}
          />
        )}

        {mode === "pending" && (
          <PendingView
            state={state}
            pending={pending}
            onCommit={commit}
            showNotice={showNotice}
          />
        )}
      </main>

        {state && subModalMode && subFormDraft && (
        <SubscriptionFormModal
          mode={subModalMode}
          draft={subFormDraft}
          state={state}
          editIndex={editIndex}
          editRow={editRow}
          language={state.language}
          onClose={closeSubModal}
          onCommit={commit}
          onNotice={showNotice}
        />
      )}

      {billForm && state && (
        <BillFormModal
          mode={billForm.billId ? "edit" : "add"}
          billId={billForm.billId ?? undefined}
          draft={billForm.draft}
          state={state}
          onClose={() => setBillForm(null)}
          onCommit={commit}
          onNotice={showNotice}
          language={state.language}
        />
      )}

      {duePickIndex !== null && state && (
        <DueDatePickerModal
          plan={state.rows[duePickIndex]?.plan ?? tr.app.fallbackPlan}
          defaultValue={
            state.rows[duePickIndex]?.dueDate || new Date().toISOString().slice(0, 10)
          }
          language={state.language}
          onCancel={() => setDuePickIndex(null)}
          onConfirm={confirmDueDate}
        />
      )}

      {showSettings && (
        <SettingsModal
          language={state?.language}
          onLanguageChange={changeLanguage}
          appearance={state?.appearance}
          onAppearanceChange={changeAppearance}
          monitorCount={state?.monitors?.length ?? 0}
          onOpenMonitor={() => { setShowSettings(false); setShowMonitor(true); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showMonitor && state && (
        <MonitorModal
          state={state}
          onCommit={commit}
          onClose={() => setShowMonitor(false)}
        />
      )}
    </div>
  );
}
