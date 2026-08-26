import { useEffect } from "react";
import { ModalCloseButton } from "./Icon";

interface ModalShellProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * 模态框通用外壳，包含：
 * - ESC 键关闭
 * - Backdrop click 关闭
 * - 标准布局（header/panel/body/footer）
 */
export function ModalShell({ title, onClose, children }: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal>
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__panel">
        {title && (
          <div className="modal__head">
            <h2 className="modal__title">{title}</h2>
            <ModalCloseButton onClick={onClose} label="关闭" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

interface FormFooterProps {
  onCancel: () => void;
  submitLabel: string;
}

/** 通用表单底部按钮区域 */
export function FormFooter({ onCancel, submitLabel }: FormFooterProps) {
  return (
    <div className="modal__foot">
      <button type="button" onClick={onCancel}>
        取消
      </button>
      <div className="modal__foot-actions">
        <button type="submit" className="primary">
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
