import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./ui/Icon";
import {
  isoToDate,
  dateToIso,
  buildCalendarDays,
  prevMonth as getPrevMonth,
  nextMonth as getNextMonth,
  isSameDay,
  formatDateForLang,
  formatYearMonthForLang,
  weekdaysForLang,
} from "./utils/dateUtils";
import { resolveLang, tFor } from "./i18n";
import type { AppState } from "@ai-sub/core";

interface Props {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (iso: string) => void;
  /** Controlled open state (optional — falls back to internal state) */
  isOpen?: boolean;
  /** Called when the user opens the picker */
  onOpen?: () => void;
  /** Called when the user closes the picker (controlled mode) */
  onClose?: () => void;
  className?: string;
  language?: AppState["language"];
}

export function CalendarPicker({
  value,
  onChange,
  isOpen: controlledOpen,
  onOpen,
  onClose,
  className,
  language,
}: Props) {
  const lang = resolveLang(language);
  const t = tFor(lang).calendar;
  const today = new Date();
  const selected = value ? isoToDate(value) : today;
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [internalOpen, setInternalOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toggleLockRef = useRef(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  // Sync view when external value changes while closed.
  // 从 value 现算而不是读渲染期派生的 selected —— selected 每次渲染都是新对象，
  // 列进依赖会让这个 effect 每帧都跑。
  /* eslint-disable react-hooks/set-state-in-effect -- 外部 value 变化时同步内部视图 */
  useEffect(() => {
    if (open) return;
    const d = value ? isoToDate(value) : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInsidePicker =
        wrapperRef.current?.contains(target) || dropdownRef.current?.contains(target);
      if (!clickedInsidePicker) {
        if (controlledOpen !== undefined) {
          onClose?.(); // signal parent to close
        } else {
          setInternalOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, controlledOpen, onClose]);

  // 日历通过 portal 渲染到 document.body，避免被可滚动的 modal body 或 footer 裁切。
  // 同时监听任意祖先滚动，保证表单滚动时弹层仍紧贴触发按钮。
  useLayoutEffect(() => {
    if (!open) return;

    const updateDropdownPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const dropdownRect = dropdownRef.current?.getBoundingClientRect();
      const width = dropdownRect?.width || 280;
      const height = dropdownRect?.height || 320;
      const gutter = 12;
      const left = Math.min(
        Math.max(gutter, triggerRect.left),
        Math.max(gutter, window.innerWidth - width - gutter)
      );
      const topBelow = triggerRect.bottom + 8;
      const top =
        topBelow + height <= window.innerHeight - gutter
          ? topBelow
          : Math.max(gutter, triggerRect.top - height - 8);
      setDropdownPosition({ top, left });
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  function setOpen(o: boolean) {
    // Prevent rapid toggling race condition
    if (toggleLockRef.current) return;
    toggleLockRef.current = true;
    setTimeout(() => { toggleLockRef.current = false; }, 150);

    if (controlledOpen !== undefined) {
      if (o) onOpen?.();
      else onClose?.();
    } else {
      setInternalOpen(o);
    }
  }

  function handlePrevMonth() {
    const [y, m] = getPrevMonth(viewYear, viewMonth);
    setViewYear(y);
    setViewMonth(m);
  }

  function handleNextMonth() {
    const [y, m] = getNextMonth(viewYear, viewMonth);
    setViewYear(y);
    setViewMonth(m);
  }

  const displayLabel = value ? formatDateForLang(selected, lang) : t.placeholder;

  return (
    <div ref={wrapperRef} className={`cal-picker${open ? " cal-picker--open" : ""}${className ? " " + className : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="cal-picker__trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {displayLabel}
        <Icon name="chevronDown" size={12} style={{ marginLeft: 6, opacity: 0.5 }} />
      </button>

      {open &&
        createPortal(
        <div
          ref={dropdownRef}
          className="cal-picker__dropdown cal-picker__dropdown--portal"
          style={
            dropdownPosition
              ? { top: dropdownPosition.top, left: dropdownPosition.left }
              : { top: 0, left: 0, visibility: "hidden" }
          }
        >
          <div className="cal-picker__nav">
            <button type="button" className="cal-picker__arrow" onClick={handlePrevMonth} aria-label={t.prevMonth}><Icon name="chevronLeft" size={14} /></button>
            <span className="cal-picker__ym">
              {formatYearMonthForLang(viewYear, viewMonth, lang)}
            </span>
            <button type="button" className="cal-picker__arrow" onClick={handleNextMonth} aria-label={t.nextMonth}><Icon name="chevronRight" size={14} /></button>
          </div>

          <div className="cal-picker__grid">
            {weekdaysForLang(lang).map(d => (
              <span key={d} className="cal-picker__dow">{d}</span>
            ))}
            {buildCalendarDays(viewYear, viewMonth).map((date, i) =>
              date ? (
                <button
                  key={i}
                  type="button"
                  className={[
                    "cal-picker__day",
                    isSameDay(date, today) ? "cal-picker__day--today" : "",
                    isSameDay(date, selected) ? "cal-picker__day--selected" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => {
                    onChange(dateToIso(date));
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              ) : (
                <span key={i} className="cal-picker__day cal-picker__day--empty" />
              )
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
