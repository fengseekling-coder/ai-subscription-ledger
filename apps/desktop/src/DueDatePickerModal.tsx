import { useState } from "react";
import type { AppState } from "@ai-sub/core";
import { CalendarPicker } from "./CalendarPicker";
import { resolveLang, tFor } from "./i18n";
import { FormFooter, ModalShell } from "./ui/ModalShell";

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

  return (
    <ModalShell title={t.title} onClose={onCancel}>
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
        <FormFooter onCancel={onCancel} submitLabel={t.confirm} />
      </form>
    </ModalShell>
  );
}
