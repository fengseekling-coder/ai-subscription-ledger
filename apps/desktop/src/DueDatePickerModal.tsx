import type { AppState } from "@ai-sub/core";
import { useEffect, useState } from "react";
import { CalendarPicker } from "./CalendarPicker";
import { resolveLang, tFor } from "./i18n";
import { ModalCloseButton } from "./ui/Icon";

export function DueDatePickerModal({
  plan,
  defaultValue,
  language,
  onCancel,
  onConfirm,
}: {
  plan: string;
  defaultValue: string;
  language: AppState["language"];
  onCancel: () => void;
  onConfirm: (isoDate: string) => void;
}) {
  const t = tFor(resolveLang(language)).duePicker;
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal" role="dialog" aria-modal>
      <div className="modal__backdrop" onClick={onCancel} />
      <div className="modal__panel" style={{ maxWidth: 400 }}>
        <div className="modal__head">
          <h2 className="modal__title">{t.title}</h2>
          <ModalCloseButton onClick={onCancel} label={tFor(resolveLang(language)).common.close} />
        </div>
        <form
          className="modal__body"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(value.trim());
          }}
        >
          <p className="modal-description">{plan}</p>
          <div className="form-field">
            <label>{t.label}</label>
            <CalendarPicker value={value} onChange={setValue} language={language} />
          </div>
          <div className="modal__foot">
            <button type="button" onClick={onCancel}>
              {t.cancel}
            </button>
            <div className="modal__foot-actions">
              <button type="submit" className="primary">
                {t.confirm}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
