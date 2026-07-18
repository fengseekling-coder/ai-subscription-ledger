import { LANGS, type LangPref, resolveLang, tFor } from "./i18n";
import type { AppState } from "@ai-sub/core";
import { ModalCloseButton } from "./ui/Icon";

interface Props {
  onClose: () => void;
  language: AppState["language"];
  onLanguageChange: (next: LangPref) => void;
}

export function SettingsModal({ onClose, language, onLanguageChange }: Props) {
  const t = tFor(resolveLang(language));
  const uiLang = resolveLang(language);
  return (
    <div className="settings-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-modal__head">
          <h2 className="settings-modal__title">{t.settings.title}</h2>
          <ModalCloseButton className="settings-modal__close" onClick={onClose} />
        </div>

        <div className="settings-modal__body">
          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">{t.settings.language}</span>
              <span className="settings-row__desc">{t.settings.languageDesc}</span>
            </div>
            <div className="seg-nav" role="radiogroup" aria-label={t.settings.language}>
              {LANGS.map((opt) => {
                const isActive = (language ?? "auto") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={isActive ? "active" : ""}
                    onClick={() => onLanguageChange(opt.value)}
                  >
                    {opt.label[uiLang]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">{t.settings.security}</span>
              <span className="settings-row__desc">{t.settings.securityNote1}</span>
              <span className="settings-row__hint">{t.settings.securityNote2}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
