import {
  addRowWithDetails,
  deleteRow,
  normalizeDateInput,
  runConnectorPaste,
  subscribeNoticeAfterToggle,
  updateRow,
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

/** 从解析结果提取表单字段值 */
function extractFields(raw: string): {
  plan?: string;
  fee?: string;
  usage?: string;
  subscribedAt?: string;
  category?: string;
} {
  const out: { plan?: string; fee?: string; usage?: string; subscribedAt?: string; category?: string } = {};

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
  const amtM = raw.match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  if (amtM && !out.fee) out.fee = amtM[1];

  const dateM = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateM && !out.subscribedAt) out.subscribedAt = dateM[1];

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
  onNotice,
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
  const [subDate, setSubDate] = useState(draft.subscribedAt);
  const [dueDate, setDueDate] = useState(draft.dueDate);
  /** "sub" | "due" | null — tracks which calendar picker is currently open */
  const [pickerOpen, setPickerOpen] = useState<"sub" | "due" | null>(null);

  const handlePasteImage = async () => {
    try {
      setOcrLoading(true);
      const img = await readImage();
      const [size, rgba] = await Promise.all([img.size(), img.rgba()]);
      if (size.width === 0 || size.height === 0) {
        onNotice("剪贴板无图片", true);
        return;
      }
      // 把 RGBA 数据转成 PNG 传给 Rust OCR
      const result = await invoke<string>("ocr_image", {
        data: Array.from(rgba),
        width: size.width,
        height: size.height,
      });
      if (result) {
        setPasteText(result);
        onNotice("已识别图片文字，请点击解析填充");
      } else {
        onNotice("未识别到文字", true);
      }
    } catch (e) {
      console.error("OCR error:", e);
      onNotice("图片识别失败", true);
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
    const fields = extractFields(pasteText);
    const form = formRef.current;
    let filled = 0;

    if (fields.plan) {
      const el = form.elements.namedItem("plan") as HTMLInputElement | null;
      if (el && !el.value) { el.value = fields.plan; filled++; }
    }
    if (fields.fee) {
      const el = form.elements.namedItem("fee") as HTMLInputElement | null;
      if (el && !el.value) { el.value = fields.fee; filled++; }
    }
    if (fields.usage) {
      const el = form.elements.namedItem("usage") as HTMLTextAreaElement | null;
      if (el && !el.value) { el.value = fields.usage; filled++; }
    }
    if (fields.subscribedAt) {
      const el = form.elements.namedItem("subscribedAt") as HTMLInputElement | null;
      if (el && !el.value) { el.value = fields.subscribedAt; filled++; }
    }
    if (fields.category) {
      const el = form.elements.namedItem("category") as HTMLSelectElement | null;
      if (el) { el.value = fields.category; filled++; }
    }

    if (filled > 0) {
      onNotice(`已填充 ${filled} 个字段`);
      setPasteText("");
      setPasteOpen(false);
    } else {
      onNotice("未识别到可填充的字段", true);
    }
  };

  return (
    <div className="modal modal--sub-form" role="dialog" aria-modal="true" aria-labelledby="sub-form-modal-title">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 id="sub-form-modal-title" className="modal__title">
            {isAdd ? "新增订阅" : "编辑订阅"}
          </h2>
          <button type="button" className="modal__close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <form
          ref={formRef}
          key={isAdd ? "add" : `edit-${editIndex}`}
          className="modal__body"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const subRaw = String(fd.get("subscribedAt") ?? "");
            const dueRaw = String(fd.get("dueDate") ?? "");
            const subIso = normalizeDateInput(subRaw);
            const dueIso = normalizeDateInput(dueRaw);
            if (subIso === null) {
              onNotice("订阅日期格式请使用 YYYY-MM-DD", true);
              return;
            }
            if (dueIso === null) {
              onNotice("续费日期格式请使用 YYYY-MM-DD", true);
              return;
            }
            const patch = {
              category: String(fd.get("category")),
              plan: String(fd.get("plan")),
              fee: String(fd.get("fee")),
              subscribedAt: subIso,
              dueDate: dueIso,
              usage: String(fd.get("usage") ?? ""),
              subscribed: fd.get("subscribed") === "on",
              expired: fd.get("expired") === "on",
            };
            if (isAdd) {
              const r = addRowWithDetails(state, patch);
              if ("error" in r) {
                onNotice(r.error, true);
                return;
              }
              onCommit(r);
              onClose();
              onNotice("已添加订阅");
              const idx = r.rows.length - 1;
              const msg = subscribeNoticeAfterToggle(r, idx);
              if (msg) onNotice(msg);
            } else if (editIndex !== null) {
              onCommit(updateRow(state, editIndex, patch));
              onClose();
              onNotice("已保存");
            }
          }}
        >
          {isAdd && (
            <div className="paste-quickfill">
              <button
                type="button"
                className="paste-quickfill__toggle"
                onClick={() => setPasteOpen(!pasteOpen)}
              >
                {pasteOpen ? "▼" : "▶"} 粘贴快速填充
              </button>
              {pasteOpen && (
                <div className="paste-quickfill__body">
                  <textarea
                    rows={3}
                    placeholder="粘贴订单文本、邮件内容、短信…&#10;如：订单 HS123 · 2026-07-05 · ¥140"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                  <div className="paste-quickfill__actions">
                    <button type="button" className="paste-quickfill__btn" onClick={applyPaste}>
                      解析文字
                    </button>
                    <button
                      type="button"
                      className="paste-quickfill__btn paste-quickfill__btn--secondary"
                      onClick={handlePasteImage}
                      disabled={ocrLoading}
                    >
                      {ocrLoading ? "识别中…" : "📷 粘贴图片 OCR"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="form-field">
            <label>分类</label>
            <select name="category" defaultValue={draft.category}>
              <option value="官方">官方</option>
              <option value="中转">中转</option>
              <option value="中转额度包">中转额度包</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div className="form-field">
            <label>套餐 / 额度</label>
            <input name="plan" required defaultValue={draft.plan} autoComplete="off" autoFocus={isAdd} />
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>月费</label>
              <input name="fee" defaultValue={draft.fee} autoComplete="off" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>订阅日期</label>
              <input type="hidden" name="subscribedAt" value={subDate} />
              <CalendarPicker
                value={subDate}
                onChange={setSubDate}
                isOpen={pickerOpen === "sub"}
                onOpen={() => setPickerOpen("sub")}
                onClose={() => setPickerOpen(null)}
              />
            </div>
            <div className="form-field">
              <label>续费日期</label>
              <input type="hidden" name="dueDate" value={dueDate} />
              <CalendarPicker
                value={dueDate}
                onChange={setDueDate}
                isOpen={pickerOpen === "due"}
                onOpen={() => setPickerOpen("due")}
                onClose={() => setPickerOpen(null)}
              />
            </div>
          </div>
          <div className="form-field">
            <label>备注</label>
            <textarea name="usage" defaultValue={draft.usage} rows={3} />
          </div>
          <label className="form-check">
            <input type="checkbox" name="subscribed" defaultChecked={draft.subscribed} />
            已订阅
          </label>
          {draft.subscribed && (
            <label className="form-check">
              <input type="checkbox" name="expired" defaultChecked={draft.expired} />
              标记为已过期
            </label>
          )}
          <div className="modal__foot">
            {!isAdd && editRow && editIndex !== null ? (
              <button
                type="button"
                className="danger-text"
                onClick={() => {
                  if (!confirm(`确定删除「${editRow.plan}」？`)) return;
                  onCommit(deleteRow(state, editIndex));
                  onClose();
                  onNotice("已删除。");
                }}
              >
                删除此条
              </button>
            ) : (
              <span />
            )}
            <div className="modal__foot-actions">
              <button type="button" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="primary">
                {isAdd ? "添加" : "保存"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
