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

const CATEGORY_OPTIONS = [
  { value: "官方", label: "官方" },
  { value: "中转", label: "中转" },
  { value: "中转额度包", label: "额度" },
  { value: "其他", label: "其他" },
] as const;

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

  // {ft.form.dates}范围：优先解析，connector 的条件判断不会覆盖已填字段
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

  useEffect(() => {
    setMatchedSub(null);
    setSubscribedChecked(draft.subscribed);
    setCategory(draft.category || "官方");
    setSubDate(draft.subscribedAt);
    setDueDate(draft.dueDate);
    setFeeError(null);
    setDateErrors({});
  }, [mode, editIndex, draft]);

  const handlePasteImage = async () => {
    try {
      setOcrLoading(true);
      const img = await readImage();
      const [size, rgba] = await Promise.all([img.size(), img.rgba()]);
      if (size.width === 0 || size.height === 0) {
        showModalNotice("剪贴板无图片", true);
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
          showModalNotice("未匹配到已有订阅，请手动选择或新建");
        }
      } else {
        showModalNotice("未识别到文字", true);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("OCR error:", msg);
      showModalNotice(`图片识别失败: ${msg}`, true);
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
      showModalNotice(`已填充 ${filled} 个字段`);
      setPasteText("");
      setPasteOpen(false);
      setDateErrors({});
    } else {
      showModalNotice("未识别到可填充的字段", true);
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
        setFeeError("{ft.form.feeError}");
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
              {isAdd ? "新增订阅" : "编辑订阅"}
            </h2>
            <p className="modal-subtitle">
              {isAdd ? "填写套餐与续费信息，或粘贴订单快速填充" : "修改套餐、金额与续费日期"}
            </p>
          </div>
          <ModalCloseButton className="modal-close" onClick={onClose} />
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
                  subValidation.message || "订阅日期格式无效",
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
                  dueValidation.message || "续费日期格式无效",
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
                showModalNotice("请选择分类", true);
                setIsSubmitting(false);
                return;
              }
              if (!plan) {
                showModalNotice("请填写套餐名称", true);
                setIsSubmitting(false);
                return;
              }
              if (fee) {
                const feeNum = moneyValue(fee);
                if (feeNum < 0 || isNaN(feeNum)) {
                  showModalNotice("金额格式无效", true);
                  setFeeError("金额格式无效");
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
                      showModalNotice("恢复订阅失败", true);
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
                    `已为「${matched.plan}」添加账单 ${amount} 元`
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
                      placeholder="{ft.form.pastePlaceholder}"
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
                          "识别中…"
                        ) : (
                          <>
                            <Icon name="camera" size={14} />
                            粘贴图片 OCR
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
                已匹配「{matchedSub.plan}」，确认后将为其添加账单
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
                  {CATEGORY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={category === opt.value}
                      className={`category-chip${
                        category === opt.value ? " is-selected" : ""
                      }`}
                      onClick={() => setCategory(opt.value)}
                    >
                      {opt.label}
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
                  placeholder="{ft.form.notePlaceholder}"
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
                if (!confirm(`确定删除「${editRow.plan}」？`)) return;
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
              删除
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
              取消
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
