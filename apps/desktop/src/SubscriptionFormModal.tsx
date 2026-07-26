import {
  addRowWithDetails,
  deleteRow,
  moneyValue,
  normalizeBill,
  normalizeEnglishMonthDate,
  runConnectorPaste,
  subById,
  subscribeNoticeAfterToggle,
  todayLocalISO,
  updateRow,
  validateDateInput,
  type AppState,
  type SubscriptionRow,
} from "@ai-sub/core";
import { invoke } from "@tauri-apps/api/core";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useRef, useState } from "react";
import { CalendarPicker } from "./CalendarPicker";
import { categoryLabel } from "./categoryLabel";
import { resolveLang, tFor } from "./i18n";
import { Icon, ModalCloseButton } from "./ui/Icon";

export type SubscriptionFormDraft = {
  category: string;
  plan: string;
  fee: string;
  subscribedAt: string;
  dueDate: string;
  usage: string;
  subscribed: boolean;
  expired: boolean;
};

/**
 * 分类选项。value 是写进账本的**数据值**，必须保持中文原样；
 * 只有 label 走字典本地化（与 SubTable 的 getCategoryStyle 同一套规则）。
 */
const CATEGORY_VALUES = ["官方", "中转", "中转额度包", "其他"] as const;

/** 从解析结果提取表单字段值，autoMatch 为 true 时自动匹配已有订阅 */
function extractFields(
  raw: string,
  stateRows: AppState["rows"],
  autoMatch: boolean = false
): {
  plan?: string;
  fee?: string;
  usage?: string;
  subscribedAt?: string;
  dueDate?: string;
  category?: string;
  matchedSubId?: string;
  matchedPlan?: string;
} {
  const out: {
    plan?: string;
    fee?: string;
    usage?: string;
    subscribedAt?: string;
    dueDate?: string;
    category?: string;
    matchedSubId?: string;
    matchedPlan?: string;
  } = {};

  // 日期范围：优先解析，connector 的条件判断不会覆盖已填字段
  const parseDateStr = (raw: string): string | null => {
    // 明确的 MM/DD/YYYY（避免整段文本去非数字后位数 > 8 时漏匹配）
    const slash = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (slash) {
      return `${slash[3]}-${slash[1]}-${slash[2]}`;
    }
    // 纯 8 位数字片段：MMDDYYYY
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 8) {
      return `${digits.slice(4, 8)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`;
    }
    // ISO 格式兜底
    const iso = raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    if (iso) return iso;
    return normalizeEnglishMonthDate(raw);
  };

  const dateRangeMatch = raw.match(/\((\d{2}\/\d{2}\/\d{4})\s*[-–—]\s*(\d{2}\/\d{2}\/\d{4})\)/);
  if (dateRangeMatch) {
    out.subscribedAt = parseDateStr(dateRangeMatch[1]) ?? undefined;
    out.dueDate = parseDateStr(dateRangeMatch[2]) ?? undefined;
  }

  // 尝试 JSON
  try {
    const result = runConnectorPaste("generic-bills-json", raw);
    if (result.rows?.length) {
      const row = result.rows[0];
      if (row.plan) out.plan = String(row.plan);
      if (row.fee) out.fee = String(row.fee);
      if (row.usage) out.usage = String(row.usage);
      if (row.category) out.category = String(row.category);
    }
  } catch {
    /* not JSON */
  }

  // 纯文本解析
  const textResult = runConnectorPaste("relay-order-text", raw);
  if (textResult.bills?.length) {
    const bill = textResult.bills[0];
    if (!out.usage && bill.note) out.usage = bill.note;
    if (!out.subscribedAt && bill.paidAt) out.subscribedAt = bill.paidAt;
    if (!out.fee && bill.amount) out.fee = String(bill.amount);
  }
  if (textResult.rows?.length) {
    const row = textResult.rows[0];
    if (!out.plan && row.plan) out.plan = row.plan;
    if (!out.fee && row.fee) out.fee = String(row.fee);
    if (!out.usage && row.usage) out.usage = row.usage;
    if (!out.category && row.category) out.category = row.category;
  }

  // 直接正则补充
  const amtM = raw.match(/\$\s*(\d+(?:\.\d+)?)/) || raw.match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  if (amtM && !out.fee) out.fee = amtM[1];

  // 日期兜底：单一日期（非范围）
  if (!out.subscribedAt) {
    out.subscribedAt = parseDateStr(raw) ?? undefined;
  }

  // 提取套餐名（更宽松的匹配）
  if (!out.plan) {
    const planM =
      raw.match(/LAX\.AS\d+\.Pro\.Pocket/i) ||
      raw.match(/LAX\.AS\d+\.Pro/i) ||
      raw.match(/LAX\.AS\d+/i) ||
      raw.match(/Pro\.Pocket/i) ||
      raw.match(/(DMIT-[A-Za-z0-9-]+)/i);
    if (planM) out.plan = planM[0].trim();
  }

  // 自动匹配已有订阅
  if (autoMatch && out.plan && stateRows) {
    const planLower = out.plan.toLowerCase();
    const exactMatch = stateRows.find(
      (r) => r.plan.toLowerCase() === planLower && r.subscribed
    );
    if (exactMatch) {
      out.matchedSubId = exactMatch.id;
      out.matchedPlan = exactMatch.plan;
      if (!out.category || out.category === "官方") {
        out.category = exactMatch.category;
      }
      if (!out.fee) {
        out.fee = exactMatch.fee;
      }
    } else {
      const partialMatch = stateRows.find(
        (r) =>
          r.subscribed &&
          r.plan.length >= 3 &&
          planLower.includes(r.plan.toLowerCase())
      );
      if (partialMatch) {
        out.matchedSubId = partialMatch.id;
        out.matchedPlan = partialMatch.plan;
        if (!out.category || out.category === "官方") {
          out.category = partialMatch.category;
        }
        if (!out.fee) {
          out.fee = partialMatch.fee;
        }
      }
    }
  }

  return out;
}

export function SubscriptionFormModal({
  mode,
  draft,
  state,
  editIndex,
  editRow,
  language,
  onClose,
  onCommit,
}: {
  mode: "add" | "edit";
  draft: SubscriptionFormDraft;
  state: AppState;
  editIndex: number | null;
  editRow: SubscriptionRow | null;
  language: AppState["language"];
  onClose: () => void;
  onCommit: (next: AppState) => void;
  onNotice: (text: string, danger?: boolean) => void;
}) {
  const ft = tFor(resolveLang(language));
  const isAdd = mode === "add";
  const formRef = useRef<HTMLFormElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [modalNotice, setModalNotice] = useState<{ text: string; danger?: boolean } | null>(null);
  const modalNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showModalNotice = (text: string, danger = false) => {
    if (modalNoticeTimer.current) clearTimeout(modalNoticeTimer.current);
    setModalNotice({ text, danger });
    modalNoticeTimer.current = setTimeout(() => {
      setModalNotice(null);
      modalNoticeTimer.current = null;
    }, danger ? 8000 : 5000);
  };
  const [matchedSub, setMatchedSub] = useState<{
    id: string;
    plan: string;
  } | null>(null);
  const [subDate, setSubDate] = useState(draft.subscribedAt);
  const [dueDate, setDueDate] = useState(draft.dueDate);
  const [pickerOpen, setPickerOpen] = useState<"sub" | "due" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateErrors, setDateErrors] = useState<{
    subscribedAt?: string;
    dueDate?: string;
  }>({});
  const [feeError, setFeeError] = useState<string | null>(null);
  const [subscribedChecked, setSubscribedChecked] = useState(draft.subscribed);
  const [category, setCategory] = useState(draft.category || "官方");

  // 切换新增/编辑目标时重置整个表单。React 推荐的写法是让父组件传 key 强制重挂，
  // 那要改 App.tsx 的调用点并核对全部 8 处表单状态的初值，单独做更稳妥。
  /* eslint-disable react-hooks/set-state-in-effect -- 表单重置，应改为父级传 key 重挂 */
  useEffect(() => {
    setMatchedSub(null);
    setSubscribedChecked(draft.subscribed);
    setCategory(draft.category || "官方");
    setSubDate(draft.subscribedAt);
    setDueDate(draft.dueDate);
    setFeeError(null);
    setDateErrors({});
  }, [mode, editIndex, draft]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePasteImage = async () => {
    try {
      setOcrLoading(true);
      const img = await readImage();
      const [size, rgba] = await Promise.all([img.size(), img.rgba()]);
      if (size.width === 0 || size.height === 0) {
        showModalNotice(ft.form.clipboardNoImage, true);
        return;
      }
      const ocrText = await invoke<string>("ocr_image", {
        data: Array.from(rgba),
        width: size.width,
        height: size.height,
      });
      if (ocrText) {
        const fields = extractFields(ocrText, state.rows, true);
        if (fields.matchedSubId && fields.matchedPlan) {
          setPasteText(ocrText);
          setMatchedSub({ id: fields.matchedSubId, plan: fields.matchedPlan });
          if (fields.category) {
            setCategory(fields.category);
          }
          if (fields.fee) {
            const el = formRef.current?.elements.namedItem(
              "fee"
            ) as HTMLInputElement | null;
            if (el) el.value = fields.fee;
          }
          if (fields.subscribedAt) {
            setSubDate(fields.subscribedAt);
          }
          showModalNotice(ft.form.matched(fields.matchedPlan));
        } else {
          setPasteText(ocrText);
          setMatchedSub(null);
          showModalNotice(ft.form.noMatchedSub);
        }
      } else {
        showModalNotice(ft.form.ocrNoText, true);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("OCR error:", msg);
      showModalNotice(ft.form.ocrFailed(msg), true);
    } finally {
      setOcrLoading(false);
    }
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const applyPaste = () => {
    if (!pasteText.trim() || !formRef.current) return;
    const fields = extractFields(pasteText, state.rows);
    const form = formRef.current;
    let filled = 0;

    if (fields.plan) {
      const el = form.elements.namedItem("plan") as HTMLInputElement | null;
      if (el && !el.value) {
        el.value = fields.plan;
        filled++;
      }
    }
    if (fields.fee) {
      const el = form.elements.namedItem("fee") as HTMLInputElement | null;
      if (el && !el.value) {
        el.value = fields.fee;
        filled++;
      }
    }
    if (fields.usage) {
      const el = form.elements.namedItem("usage") as HTMLTextAreaElement | null;
      if (el && !el.value) {
        el.value = fields.usage;
        filled++;
      }
    }
    if (fields.subscribedAt) {
      const el = form.elements.namedItem(
        "subscribedAt"
      ) as HTMLInputElement | null;
      if (el && !el.value) {
        el.value = fields.subscribedAt;
        setSubDate(fields.subscribedAt);
        filled++;
      }
    }
    if (fields.dueDate) {
      const el = form.elements.namedItem(
        "dueDate"
      ) as HTMLInputElement | null;
      if (el && !el.value) {
        el.value = fields.dueDate;
        setDueDate(fields.dueDate);
        filled++;
      }
    }
    if (fields.category) {
      setCategory(fields.category);
      filled++;
    }

    if (filled > 0) {
      showModalNotice(ft.form.filled(filled));
      setPasteText("");
      setPasteOpen(false);
      setDateErrors({});
    } else {
      showModalNotice(ft.form.noFillable, true);
    }
  };

  const handleSubDateChange = (value: string) => {
    setSubDate(value);
    const result = validateDateInput(value);
    setDateErrors((prev) => ({
      ...prev,
      subscribedAt: result.valid ? undefined : result.message,
    }));
  };

  const handleDueDateChange = (value: string) => {
    setDueDate(value);
    const result = validateDateInput(value);
    setDateErrors((prev) => ({
      ...prev,
      dueDate: result.valid ? undefined : result.message,
    }));
  };

  const handleFeeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    if (value) {
      const num = moneyValue(value);
      if (num < 0 || isNaN(num)) {
        setFeeError(ft.form.feeError);
      } else {
        setFeeError(null);
      }
    } else {
      setFeeError(null);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel sub-form-panel">
        <div className="modal-header">
          <div className="modal-header__text">
            <h2 id="modal-title" className="modal-title">
              {isAdd ? ft.form.addTitle : ft.form.editTitle}
            </h2>
            <p className="modal-subtitle">
              {isAdd ? ft.form.addSubtitle : ft.form.editSubtitle}
            </p>
          </div>
          <ModalCloseButton className="modal-close" onClick={onClose} label={ft.common.close} />
        </div>

        <div className="modal-body">
          <form
            ref={formRef}
            id="sub-form"
            className="sub-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (isSubmitting) return;
              setIsSubmitting(true);

              const fd = new FormData(e.currentTarget);
              const subRaw = String(fd.get("subscribedAt") ?? "");
              const dueRaw = String(fd.get("dueDate") ?? "");

              const subValidation = validateDateInput(subRaw);
              const dueValidation = validateDateInput(dueRaw);

              if (!subValidation.valid) {
                showModalNotice(
                  subValidation.message || ft.form.subDateInvalid,
                  true
                );
                setDateErrors((prev) => ({
                  ...prev,
                  subscribedAt: subValidation.message,
                }));
                setIsSubmitting(false);
                return;
              }
              if (!dueValidation.valid) {
                showModalNotice(
                  dueValidation.message || ft.form.dueDateInvalid,
                  true
                );
                setDateErrors((prev) => ({
                  ...prev,
                  dueDate: dueValidation.message,
                }));
                setIsSubmitting(false);
                return;
              }

              const category = String(fd.get("category") ?? "").trim();
              const plan = String(fd.get("plan") ?? "").trim();
              const fee = String(fd.get("fee") ?? "").trim();

              if (!category) {
                showModalNotice(ft.form.categoryRequired, true);
                setIsSubmitting(false);
                return;
              }
              if (!plan) {
                showModalNotice(ft.form.planRequired, true);
                setIsSubmitting(false);
                return;
              }
              if (fee) {
                const feeNum = moneyValue(fee);
                if (feeNum < 0 || isNaN(feeNum)) {
                  showModalNotice(ft.form.feeError, true);
                  setFeeError(ft.form.feeError);
                  setIsSubmitting(false);
                  return;
                }
              }

              const patch = {
                category,
                plan,
                fee,
                subscribedAt: subValidation.normalized ?? "",
                dueDate: dueValidation.normalized ?? "",
                usage: String(fd.get("usage") ?? "").trim(),
                subscribed: fd.get("subscribed") === "on",
                expired: fd.get("expired") === "on",
              };

              if (matchedSub && isAdd) {
                const matched = subById(state, matchedSub.id);
                if (matched) {
                  const formFee = String(fd.get("fee") ?? "").trim();
                  const parsedFee = formFee ? moneyValue(formFee) : 0;
                  const amount =
                    parsedFee > 0 ? parsedFee : moneyValue(matched.fee);
                  const note = String(fd.get("usage") ?? "").trim();
                  const paidAt =
                    subValidation.normalized || todayLocalISO();
                  const newBill = normalizeBill({
                    subscriptionId: matched.id,
                    amount,
                    paidAt,
                    orderId: "",
                    note,
                    kind: "payment",
                  });

                  const needsRestore =
                    matched.expired || !matched.subscribed;
                  if (needsRestore) {
                    const idx = state.rows.findIndex(
                      (r) => r.id === matchedSub.id
                    );
                    const restored = updateRow(state, idx, {
                      expired: false,
                      subscribed: true,
                    });
                    if ("error" in restored) {
                      showModalNotice(ft.form.restoreFailed, true);
                      setIsSubmitting(false);
                      return;
                    }
                    onCommit({
                      ...restored,
                      bills: [...restored.bills, newBill],
                    });
                  } else {
                    onCommit({ ...state, bills: [...state.bills, newBill] });
                  }
                  onClose();
                  showModalNotice(
                    ft.form.billAdded(matched.plan, String(amount))
                  );
                  setIsSubmitting(false);
                  return;
                }
              }

              if (isAdd) {
                const r = addRowWithDetails(state, patch);
                if ("error" in r) {
                  showModalNotice(r.error, true);
                  setIsSubmitting(false);
                  return;
                }
                onCommit(r);
                onClose();
                showModalNotice(ft.form.add);
                const idx = r.rows.length - 1;
                const msg = subscribeNoticeAfterToggle(r, idx);
                if (msg) showModalNotice(msg);
              } else if (editIndex !== null) {
                const result = updateRow(state, editIndex, patch);
                if ("error" in result) {
                  showModalNotice(result.error, true);
                  setIsSubmitting(false);
                  return;
                }
                onCommit(result);
                onClose();
                showModalNotice(ft.form.save);
              }

              setIsSubmitting(false);
            }}
          >
            {isAdd && (
              <section className={`paste-quickfill${pasteOpen ? " is-open" : ""}`}>
                <button
                  type="button"
                  className="paste-quickfill__toggle"
                  onClick={() => setPasteOpen(!pasteOpen)}
                  aria-expanded={pasteOpen}
                >
                  <span className="paste-quickfill__label">
                    <Icon name="clipboard" size={16} />
                    {ft.form.paste}
                  </span>
                  <span className={`paste-quickfill__chevron${pasteOpen ? " is-open" : ""}`}>
                    <Icon name="chevronDown" size={14} />
                  </span>
                </button>
                {pasteOpen && (
                  <div className="paste-quickfill__body">
                    <textarea
                      rows={3}
                      className="textarea"
                      placeholder={ft.form.pastePlaceholder}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                    />
                    <div className="paste-quickfill__actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={applyPaste}
                      >
                        {ft.form.parseText}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={handlePasteImage}
                        disabled={ocrLoading}
                      >
                        {ocrLoading ? (
                          ft.form.parsing
                        ) : (
                          <>
                            <Icon name="camera" size={14} />
                            {ft.form.parseOcr}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {matchedSub && (
              <div className="form-match-banner">
                {ft.form.matched(matchedSub.plan)}
              </div>
            )}

            <section className="form-section">
              <div className="form-section__title">{ft.form.basic}</div>
              <div className="form-field">
                <label id="sub-category-label">{ft.form.category}</label>
                <input type="hidden" name="category" value={category} />
                <div
                  className="category-chip-group"
                  role="radiogroup"
                  aria-labelledby="sub-category-label"
                >
                  {CATEGORY_VALUES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={category === value}
                      className={`category-chip${
                        category === value ? " is-selected" : ""
                      }`}
                      onClick={() => setCategory(value)}
                    >
                      {categoryLabel(value, ft.table)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="sub-plan">{ft.form.plan}</label>
                <input
                  id="sub-plan"
                  name="plan"
                  required
                  defaultValue={draft.plan}
                  autoComplete="off"
                  autoFocus={isAdd}
                  className="input"
                  placeholder={ft.form.planPlaceholder}
                />
              </div>

              <div className="form-field">
                <label htmlFor="sub-fee">{ft.form.fee}</label>
                <input
                  id="sub-fee"
                  name="fee"
                  defaultValue={draft.fee}
                  autoComplete="off"
                  onBlur={handleFeeBlur}
                  placeholder={ft.form.feePlaceholder}
                  className="input"
                />
                {feeError && <span className="field-error">{feeError}</span>}
              </div>
            </section>

            <section className="form-section">
              <div className="form-row">
                <div className="form-field form-field--picker">
                  <label>{ft.form.subDate}</label>
                  <input type="hidden" name="subscribedAt" value={subDate} />
                  <CalendarPicker
                    language={language}
                    value={subDate}
                    onChange={handleSubDateChange}
                    isOpen={pickerOpen === "sub"}
                    onOpen={() =>
                      setPickerOpen((prev) => (prev === "sub" ? null : "sub"))
                    }
                    onClose={() => setPickerOpen(null)}
                  />
                  {dateErrors.subscribedAt && (
                    <span className="field-error">{dateErrors.subscribedAt}</span>
                  )}
                </div>
                <div className="form-field form-field--picker">
                  <label>{ft.form.dueDate}</label>
                  <input type="hidden" name="dueDate" value={dueDate} />
                  <CalendarPicker
                    language={language}
                    value={dueDate}
                    onChange={handleDueDateChange}
                    isOpen={pickerOpen === "due"}
                    onOpen={() =>
                      setPickerOpen((prev) => (prev === "due" ? null : "due"))
                    }
                    onClose={() => setPickerOpen(null)}
                  />
                  {dateErrors.dueDate && (
                    <span className="field-error">{dateErrors.dueDate}</span>
                  )}
                </div>
              </div>
            </section>

            <section className="form-section">
              <div className="form-field">
                <label htmlFor="sub-usage">{ft.form.note}</label>
                <textarea
                  id="sub-usage"
                  name="usage"
                  defaultValue={draft.usage}
                  rows={2}
                  className="textarea"
                  placeholder={ft.form.notePlaceholder}
                />
              </div>

              <div className="form-checks">
                <label className="form-check">
                  <input
                    type="checkbox"
                    name="subscribed"
                    checked={subscribedChecked}
                    onChange={(e) => setSubscribedChecked(e.target.checked)}
                  />
                  <span className="form-check__box" aria-hidden="true" />
                  <span className="form-check__text">
                    <span className="form-check__title">{ft.form.subscribed}</span>
                    <span className="form-check__desc">{ft.form.subscribedDesc}</span>
                  </span>
                </label>

                {subscribedChecked && (
                  <label className="form-check">
                    <input
                      type="checkbox"
                      name="expired"
                      defaultChecked={draft.expired}
                    />
                    <span className="form-check__box" aria-hidden="true" />
                    <span className="form-check__text">
                      <span className="form-check__title">{ft.form.expired}</span>
                      <span className="form-check__desc">{ft.form.expiredDesc}</span>
                    </span>
                  </label>
                )}
              </div>
            </section>
          </form>

          {modalNotice && (
            <div className={`modal-notice${modalNotice.danger ? " danger" : ""}`}>
              {modalNotice.text}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!isAdd && editRow && editIndex !== null ? (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                if (!confirm(ft.form.confirmDelete(editRow.plan))) return;
                const result = deleteRow(state, editIndex);
                if ("error" in result) {
                  showModalNotice(result.error, true);
                  return;
                }
                onCommit(result);
                onClose();
                showModalNotice(ft.form.delete);
              }}
            >
              {ft.form.delete}
            </button>
          ) : (
            <span />
          )}
          <div className="modal-footer--end">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {ft.form.cancel}
            </button>
            <button
              type="submit"
              form="sub-form"
              className="btn btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isAdd
                  ? ft.form.adding
                  : ft.form.saving
                : isAdd
                  ? ft.form.add
                  : ft.form.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
