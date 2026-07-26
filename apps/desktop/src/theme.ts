// 外观主题：强调色（主题色）预设 + 应用逻辑。
// accent 只驱动单一强调色（进度条、焦点环、链接、选中态），
// 主按钮保持近黑/反白，确保整体干净。

export type ThemeMode = "system" | "light" | "dark";
export type AccentKey = "green" | "blue" | "indigo" | "teal" | "violet" | "slate";

export interface Appearance {
  mode?: ThemeMode;
  /** 强调色键名；非法值由 applyAppearance 回退到 green */
  accent?: string;
}

interface AccentVars {
  accent: string;
  hover: string;
  on: string;
  soft: string;
  muted: string;
  ink: string;
}

interface AccentPreset {
  light: AccentVars;
  dark: AccentVars;
}

export const ACCENT_ORDER: AccentKey[] = [
  "green",
  "blue",
  "indigo",
  "teal",
  "violet",
  "slate",
];

export const ACCENTS: Record<AccentKey, AccentPreset> = {
  green: {
    light: { accent: "#0f7b3f", hover: "#0b6534", on: "#ffffff", soft: "rgba(15,123,63,0.09)", muted: "#e2efe7", ink: "#0b5c30" },
    dark: { accent: "#3fbf74", hover: "#55cc86", on: "#06281a", soft: "rgba(63,191,116,0.14)", muted: "#183727", ink: "#7fd6a4" },
  },
  blue: {
    light: { accent: "#2563eb", hover: "#1d4ed8", on: "#ffffff", soft: "rgba(37,99,235,0.10)", muted: "#e6edfb", ink: "#1e40af" },
    dark: { accent: "#5b8def", hover: "#7aa3f2", on: "#0b1c3a", soft: "rgba(91,141,239,0.16)", muted: "#16213a", ink: "#9bb8f5" },
  },
  indigo: {
    light: { accent: "#4f46e5", hover: "#4338ca", on: "#ffffff", soft: "rgba(79,70,229,0.10)", muted: "#e8e7fb", ink: "#3730a3" },
    dark: { accent: "#7c79ec", hover: "#9b98f2", on: "#15123a", soft: "rgba(124,121,236,0.16)", muted: "#1c1a3a", ink: "#aaa6f5" },
  },
  teal: {
    light: { accent: "#0d9488", hover: "#0f766e", on: "#ffffff", soft: "rgba(13,148,136,0.10)", muted: "#e2f4f2", ink: "#0f766e" },
    dark: { accent: "#2dd4bf", hover: "#4ddbc8", on: "#06231f", soft: "rgba(45,212,191,0.15)", muted: "#102a27", ink: "#7fe9dc" },
  },
  violet: {
    light: { accent: "#7c3aed", hover: "#6d28d9", on: "#ffffff", soft: "rgba(124,58,237,0.10)", muted: "#efe7fb", ink: "#5b21b6" },
    dark: { accent: "#a78bfa", hover: "#bfa3fb", on: "#1f123a", soft: "rgba(167,139,250,0.16)", muted: "#231a3a", ink: "#c4b1fb" },
  },
  slate: {
    light: { accent: "#3a3a3c", hover: "#2a2a2c", on: "#ffffff", soft: "rgba(60,60,67,0.10)", muted: "#e8e8ea", ink: "#3a3a3c" },
    dark: { accent: "#c7c7cc", hover: "#d8d8dc", on: "#1c1c1e", soft: "rgba(199,199,204,0.14)", muted: "#2a2a2c", ink: "#e3e3e8" },
  },
};

/** 设置页色板预览用的实心色（始终用浅色变体，保证在白底上清晰） */
export function swatchColor(key: AccentKey): string {
  return ACCENTS[key].light.accent;
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveMode(mode: ThemeMode = "system"): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

/**
 * 应用外观：写 data-theme（强制浅/深）并把强调色变量内联到 :root。
 * 内联变量优先级高于 CSS 媒体查询，因此手动选择的强调色在两种模式下都生效。
 */
export function applyAppearance(appearance?: Appearance | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const mode: ThemeMode = appearance?.mode ?? "system";
  const accent: AccentKey =
    appearance?.accent && appearance.accent in ACCENTS
      ? (appearance.accent as AccentKey)
      : "green";

  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);

  const vars = ACCENTS[accent][resolveMode(mode)];
  root.style.setProperty("--accent", vars.accent);
  root.style.setProperty("--accent-hover", vars.hover);
  root.style.setProperty("--accent-on", vars.on);
  root.style.setProperty("--accent-soft", vars.soft);
  root.style.setProperty("--accent-muted", vars.muted);
  root.style.setProperty("--accent-ink", vars.ink);
}
