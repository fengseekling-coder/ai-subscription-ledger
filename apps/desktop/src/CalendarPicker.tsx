import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui/Icon";
import {
  isoToDate,
  dateToIso,
  buildCalendarDays,
  prevMonth as getPrevMonth,
  nextMonth as getNextMonth,
  isSameDay,
  formatDateCN,
  formatYearMonth,
  WEEKDAYS_CN,
} from "./utils/dateUtils";

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
  placeholder?: string;
}

export function CalendarPicker({ value, onChange, isOpen: controlledOpen, onOpen, onClose, className }: Props) {
  const today = new Date();
  const selected = value ? isoToDate(value) : today;
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [internalOpen, setInternalOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toggleLockRef = useRef(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  // Sync view when external value changes while closed
  useEffect(() => {
    if (!open) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value, open]);

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

  const displayLabel = value ? formatDateCN(selected) : "选择日期";

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
            <button type="button" className="cal-picker__arrow" onClick={handlePrevMonth} aria-label="上个月"><Icon name="chevronLeft" size={14} /></button>
            <span className="cal-picker__ym">
              {formatYearMonth(viewYear, viewMonth)}
            </span>
            <button type="button" className="cal-picker__arrow" onClick={handleNextMonth} aria-label="下个月"><Icon name="chevronRight" size={14} /></button>
          </div>

          <div className="cal-picker__grid">
            {WEEKDAYS_CN.map(d => (
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
