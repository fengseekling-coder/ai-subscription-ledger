import { useEffect, useState } from "react";

export function DueDatePickerModal({
  plan,
  defaultValue,
  onCancel,
  onConfirm,
}: {
  plan: string;
  defaultValue: string;
  onCancel: () => void;
  onConfirm: (isoDate: string) => void;
}) {
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
          <h2 className="modal__title">设置续费日</h2>
          <button type="button" className="modal__close" onClick={onCancel}>
            ×
          </button>
        </div>
        <form
          className="modal__body"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(value.trim());
          }}
        >
          <p className="catalog-hint" style={{ margin: "0 0 12px" }}>
            {plan}
          </p>
          <div className="form-field">
            <label>续费日</label>
            <input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <p className="catalog-hint">也可手动输入 YYYY-MM-DD，在表格日期栏里改。</p>
          <div className="modal__foot">
            <button type="button" onClick={onCancel}>
              取消
            </button>
            <div className="modal__foot-actions">
              <button type="submit" className="primary">
                确定
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}