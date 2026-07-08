import {
  addBill,
  billsForCalendarMonth,
  computeSummary,
  expiredRowEntries,
  pendingRenewItems,
  pickDueDate,
  sortedBills,
  subById,
  visibleRowEntries,
  billMatchesQuery,
  filterRowEntries,
  type AppState,
} from "@ai-sub/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BillsView } from "./BillsView";
import { CatalogModal } from "./CatalogModal";
import { Dashboard } from "./Dashboard";
import { DueDatePickerModal } from "./DueDatePickerModal";
import { PendingView } from "./PendingView";
import { SettingsModal } from "./SettingsModal";
import { StatsView } from "./StatsView";
import { SubTable } from "./SubTable";
import { buildSubTableHandlers } from "./subTableHandlers";
import { SubscriptionFormModal, type SubscriptionFormDraft } from "./SubscriptionFormModal";
import { loadAppState, persistAppState } from "./storage";
import { useRenewReminders } from "./useRenewReminders";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

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

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [mode, setMode] = useState<AppMode>("subs");
  const [notice, setNotice] = useState<{ text: string; danger?: boolean } | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [duePickIndex, setDuePickIndex] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const [notifyOn, setNotifyOn] = useState(localStorage.getItem("ai-sub-notify") === "on");
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinInput, setPinInput] = useState("");
  stateRef.current = state;

  // Check app lock on mount; if disabled, unlock immediately
  useEffect(() => {
    void invoke<boolean>("app_lock_is_enabled").then((enabled) => {
      if (!enabled) setUnlocked(true);
      setLockChecked(true);
    });
  }, []);

  const verifyPin = useCallback(async (pin: string) => {
    setPinError("");
    try {
      const ok = await invoke<boolean>("app_lock_verify_pin", { pin });
      if (ok) {
        setUnlocked(true);
        setPinInput("");
      } else {
        setPinError("PIN 错误");
      }
    } catch {
      setPinError("验证失败，请重试");
    }
  }, []);

  const showNotice = useCallback((text: string, danger = false) => {
    // Clear existing notice timer to prevent showing stale notice
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    setNotice({ text, danger });
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimer.current = null;
    }, danger ? 8000 : 5000);
  }, []);

  const commit = useCallback(
    (next: AppState, silent = false) => {
      setState(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persistAppState(next).catch(() => {
          if (!silent) showNotice("保存失败", true);
        });
      }, 200);
    },
    [showNotice]
  );

  useEffect(() => {
    if (!unlocked) return;
    setIsLoading(true);
    loadAppState()
      .then((s) => { setState(s); setIsLoading(false); })
      .catch(() => { setState(null); setIsLoading(false); showNotice("加载数据失败", true); });
  }, [unlocked, showNotice]);

  useEffect(() => {
    const unlisten = listen<string>("navigate", (e) => {
      if (e.payload === "pending") setMode("pending");
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Flush pending save on window close
  useEffect(() => {
    const w = getCurrentWindow();
    const unlisten = w.onCloseRequested(async (e) => {
      const current = stateRef.current;
      if (saveTimer.current && current) {
        e.preventDefault();
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        await persistAppState(current);
        await w.destroy();
      }
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const summary = useMemo(() => (state ? computeSummary(state) : null), [state]);
  const pending = useMemo(() => (state ? pendingRenewItems(state.rows) : []), [state]);
  const bills = useMemo(() => (state ? sortedBills(state) : []), [state]);
  const filteredBills = useMemo(() => {
    if (!state) return [];
    const q = listQuery.trim();
    if (!q) return bills;
    return bills.filter((b) => billMatchesQuery(b, subById(state, b.subscriptionId)?.plan ?? "", q));
  }, [bills, listQuery, state]);
  const subsEntries = useMemo(
    () => (state ? filterRowEntries(visibleRowEntries(state), listQuery) : []),
    [state, listQuery]
  );
  const expiredEntries = useMemo(
    () => (state ? filterRowEntries(expiredRowEntries(state), listQuery) : []),
    [state, listQuery]
  );
  const isEmptyLedger = Boolean(state && state.rows.length === 0 && state.bills.length === 0);

  const { toggleNotify } = useRenewReminders(state, notifyOn, showNotice);

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
      trayTimer.current = null;
    }, 800);
    return () => {
      if (trayTimer.current) {
        clearTimeout(trayTimer.current);
        trayTimer.current = null;
      }
    };
  }, [state, summary]);

  useEffect(() => {
    if (mode === "pending" && pending.length === 0) setMode("subs");
  }, [mode, pending.length]);

  const closeSubModal = () => {
    setEditIndex(null);
    setAddModalOpen(false);
  };

  const openAddSubscription = () => {
    setEditIndex(null);
    setAddModalOpen(true);
  };

  const confirmDueDate = (iso: string) => {
    if (!state || duePickIndex === null) return;
    const r = pickDueDate(state, duePickIndex, iso);
    setDuePickIndex(null);
    if ("error" in r) {
      showNotice(r.error, true);
      return;
    }
    commit(r.state);
  };

  const handlePrimary = () => {
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
  };

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

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading-screen">加载中…</div>
      </div>
    );
  }

  if (state === null) {
    return (
      <div className="app">
        <div className="loading-screen" style={{ color: "var(--danger)" }}>
          数据加载失败，请重启应用或检查数据文件。
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

  const monthBills = billsForCalendarMonth(state.bills);
  const billAllTotal = bills.reduce((s, b) => s + b.amount, 0);
  const billMonthTotal = monthBills.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <div className="brand__mark" aria-hidden />
            <div>
              <h1 className="brand__title">订阅账本</h1>
              <p className="brand__meta">本机私密 · 本地数据库</p>
            </div>
          </div>
          <div className="toolbar">
            <div className="toolbar__group">
              <button type="button" className="primary" onClick={handlePrimary}>
                {mode === "bills" ? "记一笔" : "新增订阅"}
              </button>
              <button type="button" onClick={() => setShowCatalog(true)}>
                服务库
              </button>
            </div>
            <div className="toolbar__group">
              <button
                type="button"
                className={notifyOn ? "is-on" : ""}
                onClick={() => void toggleNotify(!notifyOn, setNotifyOn)}
                title={notifyOn ? "点击关闭续费提醒" : "点击开启续费提醒"}
              >
                {notifyOn ? "提醒 ●" : "提醒"}
              </button>
              <button type="button" onClick={() => setShowSettings(true)} title="设置">
                ⚙
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <Dashboard state={state} summary={summary} onCommit={commit} />

        {notice && <div className={`notice ${notice.danger ? "danger" : ""}`}>{notice.text}</div>}

        {isEmptyLedger && (
          <div className="empty-ledger">
            <p className="empty-ledger__title">账本还是空的</p>
            <p className="empty-ledger__text">
              全新开始用 <strong>服务库</strong> 或 <strong>新增订阅</strong>。
            </p>
            <div className="empty-ledger__actions">
              <button type="button" className="primary" onClick={openAddSubscription}>
                新增订阅
              </button>
              <button type="button" onClick={() => setShowCatalog(true)}>
                打开服务库
              </button>
            </div>
          </div>
        )}

        <div className="view-toolbar">
          {(mode === "subs" || mode === "expired" || mode === "bills") && (
            <input
              type="search"
              className="list-search"
              placeholder={mode === "bills" ? "搜索账单、订单号、订阅名…" : "搜索套餐、分类、备注…"}
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              aria-label="搜索"
            />
          )}
          <nav className="seg-nav">
            {(
              [
                ["subs", "概览"],
                ["stats", "统计"],
                ["expired", "已过期"],
                ["bills", "账单"],
              ] as const
            ).map(([m, label]) => (
              <button key={m} type="button" className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
                {label}
              </button>
            ))}
            {pending.length > 0 && (
              <button type="button" className={mode === "pending" ? "active" : ""} onClick={() => setMode("pending")}>
                待续费
                <span className="seg-badge">{pending.length}</span>
              </button>
            )}
          </nav>
        </div>

        <div className="scroll-tip">表格可左右滑动</div>

        {mode === "stats" && <StatsView state={state} />}

        {mode === "subs" && subHandlers && (
          <section className="section">
            <div className="section__head">
              <h3 className="section__title">订阅列表</h3>
            </div>
            <div className="table-card">
              <SubTable entries={subsEntries} {...subHandlers} />
            </div>
          </section>
        )}

        {mode === "expired" && expiredSubHandlers && (
          <section className="section">
            <div className="section__head">
              <h3 className="section__title">已过期</h3>
              <span className="section__hint">不计入本月支出</span>
            </div>
            <div className="table-card">
              <SubTable entries={expiredEntries} {...expiredSubHandlers} />
            </div>
          </section>
        )}

        {mode === "bills" && (
          <BillsView
            state={state}
            bills={bills}
            filteredBills={filteredBills}
            monthBillCount={monthBills.length}
            billMonthTotal={billMonthTotal}
            billAllTotal={billAllTotal}
            onCommit={commit}
          />
        )}

        {mode === "pending" && (
          <PendingView
            state={state}
            pending={pending}
            summary={summary}
            onCommit={commit}
            showNotice={showNotice}
          />
        )}
      </main>

      {/* PIN gate — shown when app lock is enabled and not yet unlocked */}
      {lockChecked && !unlocked && (
        <div className="pin-gate">
          <div className="pin-gate__card">
            <h2 className="pin-gate__title">🔒 应用已锁定</h2>
            <p className="pin-gate__desc">输入 PIN 以解锁</p>
            <input
              className="pin-gate__input"
              type="password"
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value); setPinError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") verifyPin(pinInput); }}
              autoFocus
            />
            {pinError && <p className="pin-gate__error">{pinError}</p>}
            <button
              className="primary"
              type="button"
              onClick={() => verifyPin(pinInput)}
            >
              解锁
            </button>
          </div>
        </div>
      )}

      {state && subModalMode && subFormDraft && (
        <SubscriptionFormModal
          mode={subModalMode}
          draft={subFormDraft}
          state={state}
          editIndex={editIndex}
          editRow={editRow}
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

    </div>
  );
}