import {
  addBillWithDetails,
  updateBillDetails,
  sortRowEntries,
  type AppState,
  type BillDraft,
} from "@ai-sub/core";
import { useEffect, useMemo, useState } from "react";
import { CalendarPicker } from "./CalendarPicker";
import { resolveLang, tFor } from "./i18n";
import { ModalCloseButton } from "./ui/Icon";

type Props = {
  /** add：新增一笔；edit：编辑已有账单（billId 必填） */
  mode: "add" | "edit";
  billId?: string;
  draft: BillDraft;
  state: AppState;
  onClose: () => void;
  onCommit: (next: AppState) => void;
  onNotice: (text: string, danger?: boolean) => void;
  language: AppState["language"];
};

export function BillFormModal({ mode, billId, draft, state, onClose, onCommit, onNotice, language }: Props) {
  const t = tFor(resolveLang(language)).bills;
  const [subscriptionId, setSubscriptionId] = useState(draft.subscriptionId);
  const [amount, setAmount] = useState(draft.amount);
  const [paidAt, setPaidAt] = useState(draft.paidAt);
  const [orderId, setOrderId] = useState(draft.orderId);
  const [note, setNote] = useState(draft.note);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 下拉里按主列表同样的顺序排（在用的靠前），便于快速找到目标订阅。
  const options = useMemo(
    () =>
      sortRowEntries(state.rows.map((row, index) => ({ row, index }))).map(({ row }) => ({
        id: row.id,
        label: row.fee ? `${row.plan} · ${row.fee}` : row.plan,
      })),
    [state.rows]
  );

  const submit = () => {
    const next: BillDraft = { subscriptionId, amount, paidAt, orderId, note };
    const result =
      mode === "edit" && billId
        ? updateBillDetails(state, billId, next)
        : addBillWithDetails(state, next);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onCommit(result);
    onNotice(mode === "edit" ? t.saved : t.added);
    onClose();
  };

  return (
    <div className="modal" role="dialog" aria-modal>
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel" style={{ maxWidth: 460 }}>
        <div className="modal__head">
          <h2 className="modal__title">{mode === "edit" ? t.formEditTitle : t.formAddTitle}</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <form
          className="modal__body"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="form-field">
            <label htmlFor="bill-sub">{t.fieldSub}</label>
            <select
              id="bill-sub"
              className="select"
              value={subscriptionId}
              onChange={(e) => {
                setSubscriptionId(e.target.value);
                setError(null);
              }}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="form-field">
              <label htmlFor="bill-amount">{t.fieldAmount}</label>
              <input
                id="bill-amount"
                className="input"
                value={amount}
                inputMode="decimal"
                placeholder={t.amountPlaceholder}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="form-field form-field--picker">
              <label>{t.fieldPaidAt}</label>
              <CalendarPicker
                value={paidAt}
                onChange={(iso) => {
                  setPaidAt(iso);
                  setError(null);
                }}
              />
            </div>
          </div>

          <div className="form-field" style={{ marginTop: 12 }}>
            <label htmlFor="bill-order">{t.fieldOrderId}</label>
            <input
              id="bill-order"
              className="input"
              value={orderId}
              placeholder={t.optional}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </div>

          <div className="form-field" style={{ marginTop: 12 }}>
            <label htmlFor="bill-note">{t.fieldNote}</label>
            <input
              id="bill-note"
              className="input"
              value={note}
              placeholder={t.optional}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && (
            <span className="field-error" role="alert">
              {error}
            </span>
          )}

          <div className="modal__foot">
            <button type="button" onClick={onClose}>
              {t.cancel}
            </button>
            <div className="modal__foot-actions">
              <button type="submit" className="primary">
                {mode === "edit" ? t.save : t.add}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
