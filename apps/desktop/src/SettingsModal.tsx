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

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

/** 通用设置行 */
export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description && <span className="settings-row__desc">{description}</span>}
      </div>
      {children}
    </div>
  );
}

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
  _monitorCount,
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
          <SettingRow label={t.settings.language} description={t.settings.languageDesc}>
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
          </SettingRow>

          <SettingRow label={t.settings.themeMode} description={t.settings.themeModeDesc}>
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
          </SettingRow>

          <SettingRow label={t.settings.accent} description={t.settings.accentDesc}>
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
          </SettingRow>

          <SettingRow label={t.settings.monitorTitle} description={t.settings.monitorDesc}>
            {_monitorCount > 0 && (
              <span className="settings-row__hint">{t.settings.monitorConfigured(_monitorCount)}</span>
            )}
            <button type="button" className="btn btn--sm" onClick={onOpenMonitor}>
              {t.settings.monitorManage}
            </button>
          </SettingRow>

          <SettingRow label={t.settings.security} description={t.settings.securityNote1}>
            <span className="settings-row__hint">{t.settings.securityNote2}</span>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}
