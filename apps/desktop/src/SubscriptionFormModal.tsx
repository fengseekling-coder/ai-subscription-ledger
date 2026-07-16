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
  category?: string;
  matchedSubId?: string;
  matchedPlan?: string;
} {
  const out: {
    plan?: string;
    fee?: string;
    usage?: string;
    subscribedAt?: string;
    category?: string;
    matchedSubId?: string;
    matchedPlan?: string;
  } = {};

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

  // 日期匹配：YYYY-MM-DD, MM/DD/YYYY, 16 Jul 2026 / Jul 16 2026
  if (!out.subscribedAt) {
    const iso = raw.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    if (iso) {
      out.subscribedAt = iso;
    } else {
      const slash = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (slash) {
        out.subscribedAt = `${slash[3]}-${slash[1]}-${slash[2]}`;
      } else {
        const word = normalizeEnglishMonthDate(raw);
        if (word) out.subscribedAt = word;
      }
    }
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
  onClose,
  onCommit,
}: {
  mode: "add" | "edit";
  draft: SubscriptionFormDraft;
  state: AppState;
  editIndex: number | null;
  editRow: SubscriptionRow | null;
  onClose: () => void;
  onCommit: (next: AppState) => void;
  onNotice: (text: string, danger?: boolean) => void;
}) {
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

  useEffect(() => {
    setMatchedSub(null);
  }, [mode, editIndex]);

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
            const el = formRef.current?.elements.namedItem(
              "category"
            ) as HTMLSelectElement | null;
            if (el) el.value = fields.category;
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
          showModalNotice(
            `已自动匹配订阅「${fields.matchedPlan}」，确认后将为该订阅添加账单`
          );
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
    console.log("[OCR Debug] raw text:", pasteText.slice(0, 200));
    console.log("[OCR Debug] extracted fields:", fields);
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
    if (fields.category) {
      const el = form.elements.namedItem("category") as HTMLSelectElement | null;
      if (el) {
        el.value = fields.category;
        filled++;
      }
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
        setFeeError("金额格式无效");
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
    >
      <div className="modal-panel">
        {/* Header */}
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {isAdd ? "新增订阅" : "编辑订阅"}
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <form
            ref={formRef}
            id="sub-form"
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

              // OCR 匹配：直接添加账单
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
                  onCommit({ ...state, bills: [...state.bills, newBill] });
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
                showModalNotice("已添加订阅");
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
                showModalNotice("已保存");
              }

              setIsSubmitting(false);
            }}
          >
            {/* Paste Quick Fill */}
            {isAdd && (
              <div
                style={{
                  marginBottom: 24,
                  border: "1px dashed var(--color-text-tertiary)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setPasteOpen(!pasteOpen)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  <span>📋 粘贴快速填充</span>
                  <span
                    style={{
                      transform: pasteOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    ▼
                  </span>
                </button>
                {pasteOpen && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <textarea
                      rows={3}
                      placeholder="粘贴订单文本、邮件内容、短信..."
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 12,
                        fontSize: 14,
                        borderRadius: 8,
                        border: "1px solid var(--color-surface-secondary)",
                        background: "var(--color-surface-secondary)",
                        marginBottom: 12,
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={applyPaste}
                      >
                        解析文字
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={handlePasteImage}
                        disabled={ocrLoading}
                      >
                        {ocrLoading ? "识别中..." : "📷 粘贴图片 OCR"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Category */}
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label>分类</label>
              <select
                name="category"
                defaultValue={draft.category}
                className="select"
              >
                <option value="官方">官方</option>
                <option value="中转">中转</option>
                <option value="中转额度包">中转额度包</option>
                <option value="其他">其他</option>
              </select>
            </div>

            {/* Plan Name */}
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label>套餐 / 额度</label>
              <input
                name="plan"
                required
                defaultValue={draft.plan}
                autoComplete="off"
                autoFocus={isAdd}
                className="input"
                placeholder="例如：ChatGPT Plus"
              />
            </div>

            {/* Fee */}
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label>月费</label>
              <input
                name="fee"
                defaultValue={draft.fee}
                autoComplete="off"
                onBlur={handleFeeBlur}
                placeholder="例如：29.9"
                className="input"
              />
              {feeError && (
                <span
                  style={{
                    color: "var(--color-danger)",
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  {feeError}
                </span>
              )}
            </div>

            {/* Date Row */}
            <div className="form-row" style={{ marginBottom: 20 }}>
              <div className="form-field" style={{ position: "relative" }}>
                <label>订阅日期</label>
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
                  <span
                    style={{
                      color: "var(--color-danger)",
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {dateErrors.subscribedAt}
                  </span>
                )}
              </div>
              <div className="form-field" style={{ position: "relative" }}>
                <label>续费日期</label>
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
                  <span
                    style={{
                      color: "var(--color-danger)",
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {dateErrors.dueDate}
                  </span>
                )}
              </div>
            </div>

            {/* Usage */}
            <div className="form-field" style={{ marginBottom: 20 }}>
              <label>备注</label>
              <textarea
                name="usage"
                defaultValue={draft.usage}
                rows={3}
                className="textarea"
                placeholder="可选：添加备注信息"
              />
            </div>

            {/* Checkboxes */}
            <div style={{ marginBottom: 16 }}>
              <label className="toggle">
                <input
                  type="checkbox"
                  name="subscribed"
                  defaultChecked={draft.subscribed}
                />
                已订阅
              </label>
            </div>

            {draft.subscribed && (
              <div style={{ marginBottom: 16 }}>
                <label className="toggle">
                  <input
                    type="checkbox"
                    name="expired"
                    defaultChecked={draft.expired}
                  />
                  标记为已过期
                </label>
              </div>
            )}
          </form>
          {modalNotice && (
            <div className={`modal-notice ${modalNotice.danger ? "danger" : ""}`}>
              {modalNotice.text}
            </div>
          )}
        </div>

        {/* Footer */}
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
                showModalNotice("已删除");
              }}
            >
              删除
            </button>
          ) : (
            <span />
          )}
          <div className="modal-footer--end" style={{ gap: 12 }}>
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
                  ? "添加中..."
                  : "保存中..."
                : isAdd
                ? "添加"
                : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
