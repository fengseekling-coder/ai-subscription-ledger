import { LANGS, type LangPref, resolveLang, tFor } from "./i18n";
import type { AppState } from "@ai-sub/core";
import { ModalCloseButton } from "./ui/Icon";
import {
  ACCENT_ORDER,
  swatchColor,
  type AccentKey,
  type Appearance,
  type ThemeMode,
} from "./theme";

interface Props {
  onClose: () => void;
  language: AppState["language"];
  onLanguageChange: (next: LangPref) => void;
  appearance?: Appearance;
  onAppearanceChange: (next: Appearance) => void;
  monitorCount: number;
  onOpenMonitor: () => void;
}

export function SettingsModal({
  onClose,
  language,
  onLanguageChange,
  appearance,
  onAppearanceChange,
  monitorCount,
  onOpenMonitor,
}: Props) {
  const t = tFor(resolveLang(language));
  const uiLang = resolveLang(language);
  return (
    <div className="settings-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-modal__head">
          <h2 className="settings-modal__title">{t.settings.title}</h2>
          <ModalCloseButton className="settings-modal__close" onClick={onClose} label={t.common.close} />
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
              <span className="settings-row__label">{t.settings.themeMode}</span>
              <span className="settings-row__desc">{t.settings.themeModeDesc}</span>
            </div>
            <div className="seg-nav" role="radiogroup" aria-label={t.settings.themeMode}>
              {(["system", "light", "dark"] as ThemeMode[]).map((opt) => {
                const isActive = (appearance?.mode ?? "system") === opt;
                const label =
                  opt === "system"
                    ? t.settings.themeSystem
                    : opt === "light"
                      ? t.settings.themeLight
                      : t.settings.themeDark;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={isActive ? "active" : ""}
                    onClick={() => onAppearanceChange({ ...appearance, mode: opt })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">{t.settings.accent}</span>
              <span className="settings-row__desc">{t.settings.accentDesc}</span>
            </div>
            <div className="accent-swatches" role="radiogroup" aria-label={t.settings.accent}>
              {ACCENT_ORDER.map((key: AccentKey) => {
                const isActive = (appearance?.accent ?? "green") === key;
                const color = swatchColor(key);
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    aria-label={key}
                    title={key}
                    className={"accent-swatch" + (isActive ? " is-active" : "")}
                    style={{ background: color, color }}
                    onClick={() => onAppearanceChange({ ...appearance, accent: key })}
                  >
                    <span className={"accent-swatch__check" + (key === "slate" ? " accent-swatch__check--dark" : "")}>✓</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row__text">
              <span className="settings-row__label">{t.settings.monitorTitle}</span>
              <span className="settings-row__desc">{t.settings.monitorDesc}</span>
              {monitorCount > 0 && (
                <span className="settings-row__hint">{t.settings.monitorConfigured(monitorCount)}</span>
              )}
            </div>
            <button type="button" className="btn btn--sm" onClick={onOpenMonitor}>
              {t.settings.monitorManage}
            </button>
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
