import { useEffect, useRef, useState } from "react";

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
}

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function CalendarPicker({ value, onChange, isOpen: controlledOpen, onOpen, onClose, className }: Props) {
  const today = new Date();
  const selected = value ? isoToDate(value) : today;
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const [internalOpen, setInternalOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    if (controlledOpen !== undefined) {
      if (o) onOpen?.();
      else onClose?.();
    } else {
      setInternalOpen(o);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function buildDays(): (Date | null)[] {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(viewYear, viewMonth, d));
    return days;
  }

  function isToday(date: Date) {
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  }

  function isSelected(date: Date) {
    return date.getFullYear() === selected.getFullYear()
      && date.getMonth() === selected.getMonth()
      && date.getDate() === selected.getDate();
  }

  const displayLabel = value
    ? `${selected.getFullYear()}年${selected.getMonth() + 1}月${selected.getDate()}日`
    : "选择日期";

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
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 6, opacity: 0.5 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="cal-picker__dropdown">
          <div className="cal-picker__nav">
            <button type="button" className="cal-picker__arrow" onClick={prevMonth}>‹</button>
            <span className="cal-picker__ym">
              {viewYear}年{MONTHS[viewMonth]}
            </span>
            <button type="button" className="cal-picker__arrow" onClick={nextMonth}>›</button>
          </div>

          <div className="cal-picker__grid">
            {["日", "一", "二", "三", "四", "五", "六"].map(d => (
              <span key={d} className="cal-picker__dow">{d}</span>
            ))}
            {buildDays().map((date, i) =>
              date ? (
                <button
                  key={i}
                  type="button"
                  className={[
                    "cal-picker__day",
                    isToday(date) ? "cal-picker__day--today" : "",
                    isSelected(date) ? "cal-picker__day--selected" : "",
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
