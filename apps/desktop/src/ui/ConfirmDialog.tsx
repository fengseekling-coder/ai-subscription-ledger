import { useEffect } from "react";
import { ModalCloseButton } from "./Icon";

export type ConfirmationRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  secondaryLabel: string;
  dismissLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  /** A non-destructive alternative, such as marking a subscription unsubscribed. */
  onSecondary?: () => void;
};

export type RequestConfirmation = (request: ConfirmationRequest) => void;

type Props = ConfirmationRequest & {
  onDismiss: () => void;
};

/**
 * Application-owned confirmation dialog for destructive actions.
 *
 * Tauri's WKWebView does not reliably present the browser's native confirmation API, so every
 * destructive action goes through this visible, keyboard-accessible dialog.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  secondaryLabel,
  dismissLabel,
  destructive = false,
  onConfirm,
  onSecondary,
  onDismiss,
}: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // This dialog can sit above another modal. Capture and stop the event so
      // Escape dismisses only this confirmation, not the form beneath it.
      event.preventDefault();
      event.stopImmediatePropagation();
      onDismiss();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onDismiss]);

  const confirm = () => {
    onConfirm();
    onDismiss();
  };

  const secondary = () => {
    onSecondary?.();
    onDismiss();
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="modal__backdrop" onClick={onDismiss} />
      <div className="modal__panel">
        <div className="modal__head">
          <h2 id="confirm-dialog-title" className="modal__title">{title}</h2>
          <ModalCloseButton onClick={onDismiss} label={dismissLabel} />
        </div>
        <div className="modal__body">
          <p className="modal-description">{message}</p>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--secondary" autoFocus onClick={secondary}>
            {secondaryLabel}
          </button>
          <button
            type="button"
            className={destructive ? "btn btn--danger" : "btn btn--primary"}
            onClick={confirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
