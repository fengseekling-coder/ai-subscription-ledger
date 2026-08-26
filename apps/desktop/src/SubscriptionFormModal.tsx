import {
  addBillWithDetails,
  addInitialBillWithDetails,
  addRowWithDetails,
  deleteRow,
  effectiveFee,
  markInitialBillsRecorded,
  moneyValue,
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
import { billDraftFromSubscriptionCharge } from "./exchangeRate";
import { resolveLang, tFor } from "./i18n";
import {
  BILLING_MODEL_VALUES,
  CUSTOM_PLAN_VALUE,
  PROVIDERS,
  annualSaving,
  billingModelNeedsDueDate,
  defaultCategoryForProvider,
  defaultProviderForPlan,
  firstCycleOf,
  formDefaultsFromCategory,
  isCustomPlanMode,
  parseSeatPlan,
  totalPriceForCycle,
  type BillingModel,
  type ProviderPlan,
} from "./subscriptionFields";
import { Icon, ModalCloseButton } from "./ui/Icon";
import type { RequestConfirmation } from "./ui/ConfirmDialog";

export type SubscriptionFormDraft = {
  category: string;
  purchaseChannel?: SubscriptionRow["purchaseChannel"];
  provider?: SubscriptionRow["provider"];
  billingModel?: SubscriptionRow["billingModel"];
  plan: string;
  fee: string;
  actualFee?: string;
  subscribedAt: string;
  dueDate: string;
  usage: string;
  subscribed: boolean;
  expired: boolean;
  includeInBudget: boolean;
};

type Currency = "CNY" | "USD";
type RenewHandlerResult = AppState | void;
type RenewHandler = (
  index: number
) => RenewHandlerResult | PromiseLike<RenewHandlerResult>;

const USD_PREFIX_RE = /^\s*(?:\$|US\$|USD)/i;
const AMOUNT_PREFIX_RE = /^\s*(?:(?:USD|U\.?S\.?|US)\s*\$?|\$|¥|￥)\s*/i;

function isUsdAmount(raw: string | undefined): boolean {
  return USD_PREFIX_RE.test(String(raw ?? ""));
}

function currencyForDraft(draft: SubscriptionFormDraft, isAdd: boolean): Currency {
  if (isAdd) return "CNY";
  return isUsdAmount(draft.fee) || isUsdAmount(draft.actualFee) ? "USD" : "CNY";
}

/** Form fields display the numeric amount while persistence retains the selected currency. */
function amountInputValue(raw: string | undefined): string {
  return String(raw ?? "").trim().replace(AMOUNT_PREFIX_RE, "");
}

function persistedAmountValue(raw: string, currency: Currency): string {
  const amount = amountInputValue(raw);
  if (!amount) return "";
  return currency === "USD" ? `US$${amount}` : amount;
}

function builtInProviderForName(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return (
    PROVIDERS.find(
      (item) => item.id.toLowerCase() === normalized || item.label.toLowerCase() === normalized
    ) ?? null
  );
}

function providerNameForDraft(draft: SubscriptionFormDraft): string {
  const stored = draft.provider?.trim();
  if (stored) return stored;
  const inferredId = defaultProviderForPlan(draft.plan);
  return PROVIDERS.find((item) => item.id === inferredId)?.label ?? "";
}

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
  matchedSubId?: string;
  matchedPlan?: string;
} {
  const out: {
    plan?: string;
    fee?: string;
    usage?: string;
    subscribedAt?: string;
    dueDate?: string;
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
  onNotice,
  onRenew,
  onRequestConfirmation,
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
  onRenew?: RenewHandler;
  onRequestConfirmation: RequestConfirmation;
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
  const [includeInBudgetChecked, setIncludeInBudgetChecked] = useState(draft.includeInBudget);
  const legacyConcepts = formDefaultsFromCategory(draft.category);
  const [purchaseChannel] = useState(
    draft.purchaseChannel ?? legacyConcepts.purchaseChannel
  );
  const [provider, setProvider] = useState<string>(() => providerNameForDraft(draft));
  const [planValue, setPlanValue] = useState(
    () => parseSeatPlan(draft.plan)?.name ?? draft.plan
  );
  const [planCustom, setPlanCustom] = useState(() => isCustomPlanMode(draft.plan));
  // 人数输入框用字符串状态：允许用户先清空再输入（如 2→5），
  // 若输入时立刻 clamp 回 1，清空后框里会马上跳回 "1"，再键入 5 就变成 "15"。
  const [seatsText, setSeatsText] = useState(
    () => String(parseSeatPlan(draft.plan)?.seats ?? 2)
  );
  /** 计算与提交用的实际人数（clamp 到 1–999）；输入为空/非法时回退 1 */
  const seats = Math.max(1, Math.min(999, Math.round(Number(seatsText)) || 1));
  const [billingModel, setBillingModel] = useState<BillingModel>(
    draft.billingModel ?? legacyConcepts.billingModel
  );
  const [currency, setCurrency] = useState<Currency>(() => currencyForDraft(draft, isAdd));
  const dueDateRequired = billingModelNeedsDueDate(billingModel);
  const category = isAdd ? defaultCategoryForProvider(provider) : legacyConcepts.category;
  const modalResetKey = `${mode}:${editIndex ?? "new"}`;
  const modalResetKeyRef = useRef<string | null>(null);
  const previousDraftDueDateRef = useRef(draft.dueDate);

  useEffect(() => {
    if (modalResetKeyRef.current === modalResetKey) return;
    modalResetKeyRef.current = modalResetKey;
    const legacyDefaults = formDefaultsFromCategory(draft.category);
    const nextConcepts = {
      billingModel: draft.billingModel ?? legacyDefaults.billingModel,
    };
    setMatchedSub(null);
    setIncludeInBudgetChecked(draft.includeInBudget);
    setProvider(providerNameForDraft(draft));
    setPlanValue(parseSeatPlan(draft.plan)?.name ?? draft.plan);
    setPlanCustom(isCustomPlanMode(draft.plan));
    setSeatsText(String(parseSeatPlan(draft.plan)?.seats ?? 2));
    setBillingModel(nextConcepts.billingModel);
    setCurrency(currencyForDraft(draft, isAdd));
    setSubDate(draft.subscribedAt);
    setDueDate(draft.dueDate);
    setFeeError(null);
    setDateErrors({});
  }, [draft, isAdd, modalResetKey]);

  useEffect(() => {
    const previousDueDate = previousDraftDueDateRef.current;
    previousDraftDueDateRef.current = draft.dueDate;
    if (isAdd || previousDueDate === draft.dueDate) return;
    setDueDate(draft.dueDate);
    setDateErrors((prev) => ({ ...prev, dueDate: undefined }));
  }, [draft.dueDate, isAdd]);

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
          if (fields.fee) {
            const el = formRef.current?.elements.namedItem(
              "fee"
            ) as HTMLInputElement | null;
            if (el) el.value = amountInputValue(fields.fee);
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
      if (!planValue.trim()) {
        const seatInfo = parseSeatPlan(fields.plan);
        const baseName = seatInfo?.name ?? fields.plan;
        setPlanValue(baseName);
        setProvider(providerNameForDraft({ ...draft, plan: baseName }));
        setPlanCustom(isCustomPlanMode(baseName));
        if (seatInfo) setSeatsText(String(seatInfo.seats));
        filled++;
      }
    }
    if (fields.fee) {
      const el = form.elements.namedItem("fee") as HTMLInputElement | null;
      if (el && !el.value) {
        el.value = amountInputValue(fields.fee);
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

  const activeProvider = builtInProviderForName(provider);
  // 当前选中的内置套餐与其年付折扣（用于计费方式下拉提示，自定义/无折扣时为 null）
  const activePlanPreset =
    activeProvider?.plans.find((p) => p.name === planValue) ?? null;
  const annualDiscount = activePlanPreset ? annualSaving(activePlanPreset) : null;

  /** 按周期与人数计算内置套餐总价并填入金额框 */
  const fillFeeForPreset = (preset: ProviderPlan, cycle: BillingModel, seatCount: number) => {
    const total = totalPriceForCycle(preset, cycle, seatCount);
    if (total === null) return;
    const el = formRef.current?.elements.namedItem("fee") as HTMLInputElement | null;
    if (el) el.value = String(total);
    setFeeError(null);
  };

  const changeBillingModel = (value: BillingModel, presetOverride?: ProviderPlan | null) => {
    setBillingModel(value);
    if (!billingModelNeedsDueDate(value)) {
      setDueDate("");
      setPickerOpen((open) => (open === "due" ? null : open));
      setDateErrors((prev) => ({ ...prev, dueDate: undefined }));
    }
    // 切换周期时，若当前选中内置套餐则重算金额
    const preset =
      presetOverride !== undefined
        ? presetOverride
        : activeProvider?.plans.find((p) => p.name === planValue) ?? null;
    if (preset) fillFeeForPreset(preset, value, seats);
  };

  const changeProvider = (value: string) => {
    const nextBuiltIn = builtInProviderForName(value);
    const prevBuiltIn = builtInProviderForName(provider);
    setProvider(nextBuiltIn?.label ?? value);
    if ((nextBuiltIn?.id ?? null) === (prevBuiltIn?.id ?? null)) return;
    setPlanValue("");
    setPlanCustom(!nextBuiltIn);
  };

  /** 选择内置套餐时自动填充金额与计费方式 */
  const changePlan = (value: string) => {
    if (value === CUSTOM_PLAN_VALUE) {
      setPlanCustom(true);
      setPlanValue("");
      return;
    }
    setPlanValue(value);
    const preset = activeProvider?.plans.find((p) => p.name === value);
    if (preset) {
      setCurrency("USD");
      const cycle = firstCycleOf(preset);
      setBillingModel(cycle);
      if (!billingModelNeedsDueDate(cycle)) {
        setDueDate("");
        setPickerOpen((open) => (open === "due" ? null : open));
        setDateErrors((prev) => ({ ...prev, dueDate: undefined }));
      }
      fillFeeForPreset(preset, cycle, seats);
    }
  };

  /** 团队版人数变化时重算总价；输入途中（空/非法）暂不重算，失焦时规范化 */
  const changeSeats = (text: string) => {
    setSeatsText(text);
    const parsed = Math.round(Number(text));
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const next = Math.min(999, parsed);
    const preset = activeProvider?.plans.find((p) => p.name === planValue);
    if (preset) fillFeeForPreset(preset, billingModel, next);
  };

  const canRenew = Boolean(
    !isAdd && editRow && editIndex !== null && dueDateRequired && onRenew
  );

  const handleRenew = async () => {
    if (!canRenew || !onRenew || editIndex === null || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const renewedState = await onRenew(editIndex);
      if (renewedState) {
        const renewedRow = renewedState.rows[editIndex];
        if (renewedRow && billingModelNeedsDueDate(renewedRow.billingModel)) {
          setDueDate(renewedRow.dueDate);
          setDateErrors((prev) => ({ ...prev, dueDate: undefined }));
        }
      }
    } catch (error) {
      showModalNotice(
        ft.form.renewFailed(error instanceof Error ? error.message : "未知错误"),
        true
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCurrentSubscription = () => {
    if (!editRow || editIndex === null) return;
    const result = deleteRow(state, editIndex);
    if ("error" in result) {
      showModalNotice(result.error, true);
      return;
    }
    onCommit(result);
    onNotice(ft.notice.deleted);
    onClose();
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
            // 单行输入框内按 Enter 会隐式提交整个表单（自动激活 submit 按钮）并关闭弹窗，
            // 在人数/金额等字段里编辑到一半误按 Enter 就会意外提交，这里拦截掉；
            // 提交仍走底部「添加/保存」按钮，textarea 的 Enter 换行不受影响
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                e.preventDefault();
              }
            }}
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

              const planRaw = String(fd.get("plan") ?? "").trim();
              const feeInput = String(fd.get("fee") ?? "").trim();

              if (!planRaw) {
                showModalNotice(ft.form.planRequired, true);
                setIsSubmitting(false);
                return;
              }
              // 团队版套餐名带上人数后缀，例如 "ChatGPT Team（5人）"
              const planPreset = activeProvider?.plans.find((p) => p.name === planRaw);
              const plan =
                planPreset?.perSeat && !planCustom ? `${planRaw}（${seats}人）` : planRaw;
              if (feeInput) {
                const feeNum = moneyValue(feeInput);
                if (feeNum < 0 || isNaN(feeNum)) {
                  showModalNotice(ft.form.feeError, true);
                  setFeeError(ft.form.feeError);
                  setIsSubmitting(false);
                  return;
                }
              }
              // 实付为可选覆盖项：填了就必须是非负数字（允许 0，表示免费）
              const actualFeeInput = String(fd.get("actualFee") ?? "").trim();
              if (actualFeeInput) {
                const actualNum = moneyValue(actualFeeInput);
                if (isNaN(actualNum) || actualNum < 0) {
                  showModalNotice(ft.form.feeError, true);
                  setIsSubmitting(false);
                  return;
                }
              }

              const fee = persistedAmountValue(feeInput, currency);
              const actualFeeRaw = persistedAmountValue(actualFeeInput, currency);

              const patch = {
                category,
                provider: provider.trim(),
                plan,
                fee,
                actualFee: actualFeeRaw,
                subscribedAt: subValidation.normalized ?? "",
                dueDate: dueDateRequired ? (dueValidation.normalized ?? "") : "",
                usage: String(fd.get("usage") ?? "").trim(),
                subscribed: isAdd ? true : draft.subscribed,
                expired: isAdd ? false : draft.expired,
                includeInBudget: fd.get("includeInBudget") === "on",
                purchaseChannel,
                billingModel,
              };

              if (matchedSub && isAdd) {
                const matched = subById(state, matchedSub.id);
                if (matched) {
                  const persistedCharge = actualFeeRaw || fee || effectiveFee(matched);
                  const note = String(fd.get("usage") ?? "").trim();
                  const paidAt = subValidation.normalized || todayLocalISO();
                  const needsRestore = matched.expired || !matched.subscribed;
                  const needsMatchedUpdate =
                    needsRestore || matched.includeInBudget !== patch.includeInBudget;
                  const idx = state.rows.findIndex((r) => r.id === matchedSub.id);
                  let nextState: AppState = state;
                  if (needsMatchedUpdate) {
                    const matchedUpdate = updateRow(state, idx, {
                      includeInBudget: patch.includeInBudget,
                      ...(needsRestore ? { expired: false, subscribed: true } : {}),
                    });
                    if ("error" in matchedUpdate) {
                      if (needsRestore) showModalNotice(ft.form.restoreFailed, true);
                      setIsSubmitting(false);
                      return;
                    }
                    nextState = matchedUpdate;
                  }
                  if (moneyValue(persistedCharge) > 0) {
                    let billDraft;
                    try {
                      billDraft = await billDraftFromSubscriptionCharge({
                        subscriptionId: matched.id,
                        fee: persistedCharge,
                        paidAt,
                        note,
                      });
                    } catch (error) {
                      onCommit(nextState);
                      onClose();
                      onNotice(
                        ft.form.billPendingRate(
                          matched.plan,
                          error instanceof Error ? error.message : "未知错误"
                        ),
                        true
                      );
                      setIsSubmitting(false);
                      return;
                    }
                    const billed = addBillWithDetails(nextState, billDraft);
                    if ("error" in billed) {
                      showModalNotice(billed.error, true);
                      setIsSubmitting(false);
                      return;
                    }
                    onCommit(billed);
                    onClose();
                    onNotice(ft.form.billAdded(matched.plan, billDraft.amount));
                  } else if (needsMatchedUpdate) {
                    onCommit(nextState);
                    onClose();
                  } else {
                    onClose();
                  }
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
                const addedRow = r.rows[r.rows.length - 1];
                const paidAt = addedRow.subscribedAt || todayLocalISO();
                const charge = effectiveFee(addedRow);
                if (!(moneyValue(charge) > 0)) {
                  onCommit(markInitialBillsRecorded(r, [addedRow.id]));
                  onClose();
                  onNotice(ft.form.add);
                  setIsSubmitting(false);
                  return;
                }
                try {
                  const billDraft = await billDraftFromSubscriptionCharge({
                    subscriptionId: addedRow.id,
                    fee: charge,
                    paidAt,
                    note: addedRow.usage,
                  });
                  const billed = addInitialBillWithDetails(r, billDraft);
                  if ("error" in billed) {
                    showModalNotice(billed.error, true);
                    setIsSubmitting(false);
                    return;
                  }
                  onCommit(billed);
                  onClose();
                  onNotice(ft.form.billAdded(addedRow.plan, billDraft.amount));
                } catch (error) {
                  // 订阅资料依然保存；下一次启动会安全地重试尚未入账的首笔账单。
                  onCommit(r);
                  onClose();
                  onNotice(
                    ft.form.billPendingRate(
                      addedRow.plan,
                      error instanceof Error ? error.message : "未知错误"
                    ),
                    true
                  );
                }
                const idx = r.rows.length - 1;
                const msg = subscribeNoticeAfterToggle(r, idx);
                if (msg) onNotice(msg);
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
              <div className="form-row form-row--concepts">
                <div className="form-field">
                  <label htmlFor="sub-provider">{ft.form.provider}</label>
                  <input
                    id="sub-provider"
                    name="provider"
                    className="input"
                    value={provider}
                    onChange={(event) => changeProvider(event.target.value)}
                    list="sub-provider-options"
                    autoComplete="off"
                    placeholder={ft.form.providerPlaceholder}
                  />
                  <datalist id="sub-provider-options">
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.label} />
                    ))}
                    <option value={ft.form.other} />
                  </datalist>
                </div>
                <div className="form-field">
                  <label htmlFor="sub-billing-model">{ft.form.billingModel}</label>
                  <select
                    id="sub-billing-model"
                    name="billingModel"
                    className="select"
                    value={billingModel}
                    onChange={(event) => changeBillingModel(event.target.value as BillingModel)}
                  >
                    {BILLING_MODEL_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value === "年付" && annualDiscount
                          ? ft.form.annualWithSave(annualDiscount.percentOff)
                          : ft.form.billingModelOptions[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-field">
                <div className="form-field__label-row">
                  <label htmlFor="sub-plan">{ft.form.plan}</label>
                  {activeProvider && planCustom && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setPlanCustom(false);
                        setPlanValue("");
                      }}
                    >
                      {ft.form.backToPresets}
                    </button>
                  )}
                </div>
                {activeProvider && !planCustom ? (
                  <div className="plan-field-row">
                    <select
                      id="sub-plan"
                      name="plan"
                      required
                      className="select"
                      value={planValue}
                      onChange={(event) => changePlan(event.target.value)}
                    >
                      <option value="" disabled>
                        {ft.form.selectPlan}
                      </option>
                      {activeProvider.plans.map((p) => {
                        const unit = p.prices["月付"] ?? "";
                        return (
                          <option key={p.name} value={p.name}>
                            {p.perSeat
                              ? ft.form.planLabelPerSeat(p.name, unit)
                              : ft.form.planLabel(p.name, unit)}
                          </option>
                        );
                      })}
                      <option value={CUSTOM_PLAN_VALUE}>{ft.form.customPlan}</option>
                    </select>
                    {activeProvider.plans.find((p) => p.name === planValue)?.perSeat && (
                      <label className="seats-field" htmlFor="sub-seats">
                        <input
                          id="sub-seats"
                          type="number"
                          min={1}
                          max={999}
                          className="input seats-field__input"
                          value={seatsText}
                          onChange={(event) => changeSeats(event.target.value)}
                          onBlur={() => setSeatsText(String(seats))}
                          aria-label={ft.form.seatsUnit}
                        />
                        <span className="seats-field__unit">{ft.form.seatsUnit}</span>
                      </label>
                    )}
                  </div>
                ) : (
                  <input
                    id="sub-plan"
                    name="plan"
                    required
                    value={planValue}
                    onChange={(event) => setPlanValue(event.target.value)}
                    autoComplete="off"
                    className="input"
                    placeholder={ft.form.planPlaceholder}
                  />
                )}
              </div>

              <div className="currency-choice" role="radiogroup" aria-label={ft.form.currency}>
                <span className="currency-choice__label">{ft.form.currency}</span>
                <label className="currency-choice__option">
                  <input
                    type="radio"
                    name="currency"
                    value="CNY"
                    checked={currency === "CNY"}
                    onChange={() => setCurrency("CNY")}
                  />
                  <span>{ft.form.currencyCny}</span>
                </label>
                <label className="currency-choice__option">
                  <input
                    type="radio"
                    name="currency"
                    value="USD"
                    checked={currency === "USD"}
                    onChange={() => setCurrency("USD")}
                  />
                  <span>{ft.form.currencyUsd}</span>
                </label>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="sub-fee">{ft.form.fee}</label>
                  <input
                    id="sub-fee"
                    name="fee"
                    defaultValue={amountInputValue(draft.fee)}
                    autoComplete="off"
                    onBlur={handleFeeBlur}
                    placeholder={ft.form.feePlaceholder}
                    className="input"
                  />
                  {feeError && <span className="field-error">{feeError}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="sub-actual-fee">{ft.form.actualFee}</label>
                  <input
                    id="sub-actual-fee"
                    name="actualFee"
                    defaultValue={amountInputValue(draft.actualFee)}
                    autoComplete="off"
                    placeholder={ft.form.actualFeePlaceholder}
                    className="input"
                  />
                </div>
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
                {dueDateRequired ? (
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
                ) : (
                  <div className="form-field billing-no-renewal">
                    <span className="billing-no-renewal__label">{ft.form.dueDate}</span>
                    <span className="billing-no-renewal__value">{ft.form.noRenewalDate}</span>
                  </div>
                )}
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
                    name="includeInBudget"
                    checked={includeInBudgetChecked}
                    onChange={(e) => setIncludeInBudgetChecked(e.target.checked)}
                  />
                  <span className="form-check__box" aria-hidden="true" />
                  <span className="form-check__text">
                    <span className="form-check__title">{ft.form.includeInBudget}</span>
                    <span className="form-check__desc">{ft.form.includeInBudgetDesc}</span>
                  </span>
                </label>
                {canRenew && (
                  <button
                    type="button"
                    className="btn btn--renew"
                    onClick={() => void handleRenew()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? ft.form.renewing : ft.form.renew}
                  </button>
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
              onClick={() =>
                onRequestConfirmation({
                  title: ft.form.delete,
                  message: ft.form.confirmDelete(editRow.plan),
                  confirmLabel: ft.form.confirmDeleteAction,
                  secondaryLabel: ft.form.cancel,
                  dismissLabel: ft.common.close,
                  destructive: true,
                  onConfirm: deleteCurrentSubscription,
                })
              }
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
