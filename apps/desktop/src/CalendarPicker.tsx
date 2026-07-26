import { useEffect, useRef, useState } from "react";
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
  const toggleLockRef = useRef(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  // Sync view when external value changes while closed.
  // 从 value 现算而不是读渲染期派生的 selected —— selected 每次渲染都是新对象，
  // 列进依赖会让这个 effect 每帧都跑。
  /* eslint-disable react-hooks/set-state-in-effect -- 外部 value 变化时同步内部视图；改用父级传 key 重挂需要改所有调用方，另行处理 */
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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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
        type="button"
        className="cal-picker__trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {displayLabel}
        <Icon name="chevronDown" size={12} style={{ marginLeft: 6, opacity: 0.5 }} />
      </button>

      {open && (
        <div className="cal-picker__dropdown">
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
        </div>
      )}
    </div>
  );
}
