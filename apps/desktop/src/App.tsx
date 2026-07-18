import {
  addBill,
  billsForCalendarMonth,
  computeSummary,
  expiredRowEntries,
  fmtMoney,
  pendingRenewItems,
  pickDueDate,
  sortedBills,
  visibleRowEntries,
  type AppState,
} from "@ai-sub/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BillsView } from "./BillsView";
import { CatalogModal } from "./CatalogModal";
import { Dashboard } from "./Dashboard";
import { DueDatePickerModal } from "./DueDatePickerModal";
import { PendingView } from "./PendingView";
import { SettingsModal } from "./SettingsModal";
import { resolveLang, tFor, type LangPref } from "./i18n";
import { StatsView } from "./StatsView";
import { SubTable } from "./SubTable";
import { buildSubTableHandlers } from "./subTableHandlers";
import { SubscriptionFormModal, type SubscriptionFormDraft } from "./SubscriptionFormModal";
import { loadAppState, persistAppState } from "./storage";
import { useRenewReminders } from "./useRenewReminders";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Icon } from "./ui/Icon";

type AppMode = "subs" | "expired" | "bills" | "pending" | "stats";

const NEW_SUBSCRIPTION_DRAFT: SubscriptionFormDraft = {
  category: "官方",
  plan: "",
  fee: "",
  subscribedAt: "",
  dueDate: "",
  usage: "",
  subscribed: false,
  expired: false,
};

// Custom hook for debounced persistence with flush-on-hide + flush-on-unload
function useDebouncedPersistence(state: AppState | null) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    if (!state) return;
    
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistAppState(state).catch(() => {});
    }, 200);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [state]);

  // Flush pending save immediately when the window becomes hidden or the
  // page is about to unload. Without this, force-kill / OS sleep / immediate
  // window close within the 200 ms debounce window loses the latest edit.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const current = stateRef.current;
      if (current) {
        void persistAppState(current);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current && stateRef.current) {
        clearTimeout(saveTimer.current);
        void persistAppState(stateRef.current);
      }
    };
  }, []);

  return stateRef;
}

// Custom hook for tray menu updates
function useTrayMenu(state: AppState | null, summary: ReturnType<typeof computeSummary> | null) {
  const trayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state || !summary) return;
    
    const nearest =
      summary.nearestPlan && summary.nearestDueDate
        ? `下一续费：${summary.nearestPlan} · ${summary.nearestDueDate}`
        : "下一续费：—";

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
  }, [state, summary]);
}

// Custom hook for window close handling
function useWindowCloseHandler(stateRef: React.MutableRefObject<AppState | null>) {
  useEffect(() => {
    const w = getCurrentWindow();
    const unlisten = w.onCloseRequested(async (e) => {
      const current = stateRef.current;
      if (current) {
        e.preventDefault();
        await persistAppState(current);
        await w.destroy();
      }
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [stateRef]);
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
    }, danger ? 8000 : 5000);
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
  const [showCatalog, setShowCatalog] = useState(false);
  const [duePickIndex, setDuePickIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notifyOn, setNotifyOn] = useState(localStorage.getItem("ai-sub-notify") === "on");
  
  // Hooks
  const { notice, showNotice } = useNotice();
  const stateRef = useDebouncedPersistence(state);
  useWindowCloseHandler(stateRef);

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

  // Load data
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadAppState()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch((e) => {
        if (!cancelled) {
          setState(null);
          showNotice(e instanceof Error ? e.message : "加载数据失败", true);
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
  useTrayMenu(state, summary);
  useNavigation(setMode);
  const { toggleNotify } = useRenewReminders(state, notifyOn, showNotice);

  // Auto-switch from pending if empty
  useEffect(() => {
    if (mode === "pending" && pending.length === 0) setMode("subs");
  }, [mode, pending.length]);

  // Handlers
  const commit = useCallback((next: AppState) => {
    setState(next);
  }, []);

  const changeLanguage = useCallback((next: LangPref) => {
    setState((prev) => (prev ? { ...prev, language: next } : prev));
    showNotice(next === "en" ? "Language: English" : next === "zh-CN" ? "语言：简体中文" : "语言：跟随系统");
  }, [showNotice]);

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

  const handlePrimary = useCallback(() => {
    if (!state) return;
    if (mode === "bills") {
      const r = addBill(state);
      if ("error" in r) {
        showNotice(r.error, true);
        return;
      }
      commit(r);
      showNotice("已添加账单");
      return;
    }
    openAddSubscription();
  }, [state, mode, commit, showNotice, openAddSubscription]);

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
          <div>数据加载失败，请重启应用或检查数据文件。</div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setIsLoading(true);
              loadAppState()
                .then((s) => setState(s))
                .catch((e) => showNotice(e instanceof Error ? e.message : "加载数据失败", true))
                .finally(() => setIsLoading(false));
            }}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="app">
        <div className="loading-screen">加载中…</div>
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
                {tr.toolbar.add}
              </button>
              <button type="button" onClick={() => setShowCatalog(true)}>
                {tr.toolbar.catalog}
              </button>
            </div>
            <div className="toolbar__group">
              <button
                type="button"
                className={notifyOn ? "is-on" : ""}
                onClick={() => void toggleNotify(!notifyOn, setNotifyOn)}
                title={notifyOn ? "续费提醒已开" : "续费提醒已关"}
                aria-label={notifyOn ? "关闭续费提醒" : "开启续费提醒"}
                aria-pressed={notifyOn}
              >
                <Icon name="bell" size={15} />
              </button>
              <button type="button" onClick={() => setShowSettings(true)} title="设置" aria-label={tr.toolbar.settings}>
                <Icon name="settings" size={15} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <nav className="seg-nav seg-nav--page" aria-label="页面">
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
              <button type="button" onClick={() => setShowCatalog(true)}>
                {tr.empty.fromCatalog}
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
              <SubTable entries={subsEntries} {...subHandlers} />
            </div>
          </section>
        )}

        {mode === "expired" && expiredSubHandlers && (
          <section className="section">
            <div className="table-card">
              <SubTable entries={expiredEntries} {...expiredSubHandlers} />
            </div>
          </section>
        )}

        {mode === "bills" && (
          <BillsView state={state} bills={bills} onCommit={commit} onNotice={showNotice} />
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

      {duePickIndex !== null && state && (
        <DueDatePickerModal
          plan={state.rows[duePickIndex]?.plan ?? "订阅"}
          defaultValue={
            state.rows[duePickIndex]?.dueDate || new Date().toISOString().slice(0, 10)
          }
          onCancel={() => setDuePickIndex(null)}
          onConfirm={confirmDueDate}
        />
      )}

      {showCatalog && state && (
        <CatalogModal
          state={state}
          onClose={() => setShowCatalog(false)}
          onCommit={(next) => {
            commit(next);
            showNotice("已从服务库添加");
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          language={state?.language}
          onLanguageChange={changeLanguage}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
