import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  addBill,
  addRowWithDetails,
  computeSummary,
  deleteBill,
  deleteRow,
  expiredRowEntries,
  markExpired,
  pendingRenewItems,
  pickDueDate,
  renewRow,
  setBudget,
  sortedBills,
  toggleSubscribe,
  updateRow,
  visibleRowEntries,
  markUnrenewed,
  clearExpired,
  type AppState,
  type Summary,
} from "@ai-sub/core";

export type AppMode = "subs" | "expired" | "bills" | "pending" | "stats";

interface NoticeState {
  text: string;
  danger?: boolean;
}

interface AppStore {
  // Core state
  state: AppState | null;
  isLoading: boolean;
  setState: (state: AppState | null) => void;
  setIsLoading: (loading: boolean) => void;

  // UI state
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  notice: NoticeState | null;
  showNotice: (text: string, danger?: boolean) => void;
  clearNotice: () => void;

  // Modals
  editIndex: number | null;
  addModalOpen: boolean;
  showCatalog: boolean;
  showSettings: boolean;
  duePickIndex: number | null;

  setEditIndex: (index: number | null) => void;
  setAddModalOpen: (open: boolean) => void;
  setShowCatalog: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setDuePickIndex: (index: number | null) => void;

  // Lock state
  unlocked: boolean;
  lockChecked: boolean;
  setUnlocked: (unlocked: boolean) => void;
  setLockChecked: (checked: boolean) => void;

  // Notifications
  notifyOn: boolean;
  setNotifyOn: (on: boolean) => void;

  // Computed (selectors)
  getSummary: () => Summary | null;
  getPending: () => ReturnType<typeof pendingRenewItems>;
  getBills: () => ReturnType<typeof sortedBills>;
  getMonthBills: () => ReturnType<typeof sortedBills>;
  getSubsEntries: () => ReturnType<typeof visibleRowEntries>;
  getExpiredEntries: () => ReturnType<typeof expiredRowEntries>;
  getIsEmptyLedger: () => boolean;

  // Actions
  commit: (next: AppState) => void;
  toggleSubscription: (index: number) => void;
  markRowExpired: (index: number) => void;
  clearRowExpired: (index: number) => void;
  deleteRowByIndex: (index: number) => void;
  handleRenew: (index: number) => void;
  handleUnrenewed: (index: number, choice: "delete" | "unsubscribe") => void;
  setDueDate: (index: number, date: string) => void;
  updateBudget: (budget: number) => void;
  addNewBill: () => void;
  deleteBillById: (billId: string) => void;
  addSubscription: (details: Parameters<typeof addRowWithDetails>[1]) => void;
  updateSubscription: (index: number, patch: Parameters<typeof updateRow>[2]) => void;
}

export const useAppStore = create<AppStore>()(
  immer((set, get) => ({
    // Initial state
    state: null,
    isLoading: true,
    mode: "subs",
    notice: null,
    editIndex: null,
    addModalOpen: false,
    showCatalog: false,
    showSettings: false,
    duePickIndex: null,
    unlocked: false,
    lockChecked: false,
    notifyOn: typeof localStorage !== "undefined" && localStorage.getItem("ai-sub-notify") === "on",

    // Setters
    setState: (state) => set({ state }),
    setIsLoading: (isLoading) => set({ isLoading }),
    setMode: (mode) => set({ mode }),
    setEditIndex: (editIndex) => set({ editIndex }),
    setAddModalOpen: (addModalOpen) => set({ addModalOpen }),
    setShowCatalog: (showCatalog) => set({ showCatalog }),
    setShowSettings: (showSettings) => set({ showSettings }),
    setDuePickIndex: (duePickIndex) => set({ duePickIndex }),
    setUnlocked: (unlocked) => set({ unlocked }),
    setLockChecked: (lockChecked) => set({ lockChecked }),
    setNotifyOn: (notifyOn) => {
      set({ notifyOn });
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ai-sub-notify", notifyOn ? "on" : "off");
      }
    },

    // Notice
    showNotice: (text, danger = false) => {
      set({ notice: { text, danger } });
      setTimeout(() => set({ notice: null }), danger ? 8000 : 5000);
    },
    clearNotice: () => set({ notice: null }),

    // Selectors
    getSummary: () => {
      const { state } = get();
      return state ? computeSummary(state) : null;
    },
    getPending: () => {
      const { state } = get();
      return state ? pendingRenewItems(state.rows) : [];
    },
    getBills: () => {
      const { state } = get();
      return state ? sortedBills(state) : [];
    },
    getMonthBills: () => {
      const { state } = get();
      return state ? sortedBills(state) : [];
    },
    getSubsEntries: () => {
      const { state } = get();
      return state ? visibleRowEntries(state) : [];
    },
    getExpiredEntries: () => {
      const { state } = get();
      return state ? expiredRowEntries(state) : [];
    },
    getIsEmptyLedger: () => {
      const { state } = get();
      return Boolean(state && state.rows.length === 0 && state.bills.length === 0);
    },

    // Actions
    commit: (next) => {
      set({ state: next });
    },

    toggleSubscription: (index) => {
      const { state, commit, showNotice } = get();
      if (!state) return;
      const result = toggleSubscribe(state, index);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
      }
    },

    markRowExpired: (index) => {
      const { state, commit, showNotice } = get();
      if (!state) return;
      const result = markExpired(state, index);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
      }
    },

    clearRowExpired: (index) => {
      const { state, commit, showNotice } = get();
      if (!state) return;
      const result = clearExpired(state, index);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
      }
    },

    deleteRowByIndex: (index) => {
      const { state, commit, showNotice } = get();
      if (!state) return;
      const result = deleteRow(state, index);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
      }
    },

    handleRenew: (index) => {
      const { state, commit, showNotice } = get();
      if (!state) return;
      const result = renewRow(state, index);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
        showNotice("已续费");
      }
    },

    handleUnrenewed: (index, choice) => {
      const { state, commit, showNotice } = get();
      if (!state) return;
      const result = markUnrenewed(state, index, choice);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
        showNotice(choice === "delete" ? "已删除" : "已改为未订阅");
      }
    },

    setDueDate: (index, date) => {
      const { state, commit, showNotice, setDuePickIndex } = get();
      if (!state) return;
      const result = pickDueDate(state, index, date);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result.state);
        setDuePickIndex(null);
      }
    },

    updateBudget: (budget) => {
      const { state, commit } = get();
      if (!state) return;
      commit(setBudget(state, budget));
    },

    addNewBill: () => {
      const { state, commit, showNotice } = get();
      if (!state) return;
      const result = addBill(state);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
        showNotice("已添加账单");
      }
    },

    deleteBillById: (billId) => {
      const { state, commit } = get();
      if (!state) return;
      commit(deleteBill(state, billId));
    },

    addSubscription: (details) => {
      const { state, commit, showNotice, setAddModalOpen } = get();
      if (!state) return;
      const result = addRowWithDetails(state, details);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
        setAddModalOpen(false);
        showNotice("已添加订阅");
      }
    },

    updateSubscription: (index, patch) => {
      const { state, commit, showNotice, setEditIndex } = get();
      if (!state) return;
      const result = updateRow(state, index, patch);
      if ("error" in result) {
        showNotice(result.error, true);
      } else {
        commit(result);
        setEditIndex(null);
        showNotice("已保存");
      }
    },
  }))
);
